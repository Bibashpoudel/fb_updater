/*
*
* NOTE :: THIS IS SERVICE MODULE AND SO 
* DO NOT WRAP THE CODE IN TRY CATCH BLOCK AS IT WILL NOT ALLOW TO ERROR HANDLING IN PARENT FUNCTION
*
*/

const axios = require('axios');
const { addDays, format } = require('date-fns');
const { Enums, helperFns } = require('../../utils')
const Models = require('../../models/mongo-db').default
const SocialMediaProfileService = require('../social-media')
const { fbGraphApiClient } = require('../../axios-clients')
const { profileFeedsNextPageRequestInterval } = require('../../config')
const SmProfileUpdateEmitter = require('../../event-emitters/SmProfileUpdateEmitter');
const moment = require('moment-timezone');
const configs = require('../../config');


/* request feed pagitionations*/
const requestProfileFeedsNextPage = async (profile, feedLimit = 100, nextPageToken) => {
  try {
    logger.info('page feed next page requested')

    /* requesting for next pagination */
    let params = {
      fields: `comments.summary(1),shares,message,created_time,attachments{media,media_type,type,url},from,permalink_url,reactions.type(LIKE).limit(0).summary(1).as(like),reactions.type(LOVE).limit(0).summary(1).as(love),reactions.type(HAHA).limit(0).summary(1).as(haha),reactions.type(WOW).limit(0).summary(1).as(wow),reactions.type(SAD).limit(0).summary(1).as(sad),reactions.type(ANGRY).limit(0).summary(1).as(angry)`,
      after: nextPageToken,
      limit: feedLimit
    }

    const nextPageResponse = await fbGraphApiClient.get(`${profile['social_page_id']}/posts`, { params });

    console.log('nextPageResponse', nextPageResponse);

    if (nextPageResponse.data.data == 0) {
      return;
    }

    await saveProfileFeeds(nextPageResponse.data, profile, feedLimit);
  } catch (error) {
    const { response, status, statusText } = error;

    if (response) {
      const { config, data: { error: { code } }, request: { socket: { servername, _host } } } = response;

      SmProfileUpdateEmitter.emit('profile-next-page-request-error', {
        code: code,
        profile: profile,
        feedLimit: feedLimit,
        nextPageToken: nextPageToken
      });

      logger.error(`requestProfileFeedsNextPage >> in try >> code ${code}`);
    } else {
      /* restart profile update profile when thers is reponse in error*/
      SmProfileUpdateEmitter.emit('update-social-profiles');

      logger.error(error);
    }
    logger.error(error);
  }
}

const saveProfileFeeds = async (pageFeeds, profile, feedLimit) => {
  const feeds = pageFeeds.data;

  for (const key in feeds) {
    if (Object.hasOwnProperty.call(feeds, key)) {
      const feed = feeds[key];

      const feed_like_count = feed.like ? (feed.like.summary ? feed.like.summary.total_count : 0) : 0;
      const feed_haha_count = feed.haha ? (feed.haha.summary ? feed.haha.summary.total_count : 0) : 0;
      const feed_wow_count = feed.wow ? (feed.wow.summary ? feed.wow.summary.total_count : 0) : 0;
      const feed_love_count = feed.love ? (feed.love.summary ? feed.love.summary.total_count : 0) : 0;

      const feedAttachment = feed['attachments'] && feed.attachments.data[0].media ? (feed.attachments.data[0].media_type == 'video' ? feed.attachments.data[0].url : feed.attachments.data[0].media.image['src']) : null;
      const thumbnail = feed['attachments'] && feed.attachments.data[0].media ? (feed.attachments.data[0].media_type == 'video' ? feed.attachments.data[0].media.image['src'] : null) : null;
      const feedType = feed['attachments'] ? ['link'].includes(feed.attachments.data[0].media_type) ? 'status' : feed.attachments.data[0].media_type : 'status';


      const feedCreatedDate = format(new Date(feed['created_time']), Enums.DATE_FORMAT);

      if (feed.from.id != profile.social_page_id) {
        continue;
      } else {
        /* Storing or updating facebook page feeds */
        await Models.FacebookPageFeed.findOneAndUpdate(
          {
            profile_id: profile['social_page_id'],
            feed_id: feed['id'],
          },
          {
            feed_id: feed['id'],
            profile_id: profile['social_page_id'],
            feed_type: feedType,
            feed_link: feed['permalink_url'],
            caption: feed['message'] ? feed['message'] : '',
            attachment: feedAttachment,
            thumbnail: thumbnail,
            feed_share_count: feed['shares'] ? feed.shares['count'] : 0,
            feed_comment_count: feed['comments'] ? feed.comments.summary['total_count'] : 0,
            feed_like_count,
            feed_love_count,
            feed_haha_count,
            feed_wow_count,
            feed_created_date: feedCreatedDate,
            feed_created_date_utc: feed['created_time']
          },
          {
            new: true,
            upsert: true, // Make this update into an upsert
          },
        );

        /* Storing unique color for Feed type */
        await SocialMediaProfileService.storeFeedTypeUniqueColor('facebook', feedType);
      }
    }
  }

  if (pageFeeds.paging && pageFeeds.paging['next']) {
    /* request for next page after a time set in env variable*/
    const { cursors } = pageFeeds['paging']

    if (cursors.after) {
      await new Promise((resolve, reject) => {
        setTimeout(async () => {

          await requestProfileFeedsNextPage(profile, feedLimit, cursors.after)
          resolve();
        }, profileFeedsNextPageRequestInterval * 1000);
      });
    }
  } else {

    /* when all feed saved  setting the is_data_downloading to false indicating profile feed downloaded*/
    profile.is_data_downloading = false;
    profile.save()

    return 0;
  }
};


SmProfileUpdateEmitter.on('profile-next-page-request-error', async function (data) {
  logger.info('error handling for emmiter', data);
  const { code, profile, feedLimit, nextPageToken } = data;

  /* Trying to update profile when */
  switch (code) {
    case 1:
      let newFeedLimit = (feedLimit / 2);

      newFeedLimit = newFeedLimit > 0 ? newFeedLimit : 1;
      await new Promise(async (resolve, reject) => {
        await requestProfileFeedsNextPage(profile, newFeedLimit, nextPageToken);
        resolve()
      })
      break;
    case 4:
      /* APP RATE LIMIT CASE*/
      const scheduleTime = 1 * 3600000; // 1 hours

      /* Sheduling for next time*/
      SmProfileUpdateEmitter.emit('schedule-profile-next-page-request', { scheduleTime, profile, feedLimit, nextPageToken });
      break;

    default:
      break;
  }
});


SmProfileUpdateEmitter.on('schedule-profile-next-page-request', function (data) {

  const { scheduleTime, profile, newFeedLimit, nextPageToken } = data

  if (Number.isInteger(scheduleTime)) {
    setTimeout(function () {
      requestProfileFeedsNextPage(profile, newFeedLimit, nextPageToken);
    }, scheduleTime);

    console.log('Scheduled for hours', helperFns.parseMillisecondsIntoReadableTime(scheduleTime));
  }
});

module.exports = {

  createOrUpdateProfile: async (profile, feedLimit = 100) => {
    const todayDate = format(new Date(), Enums.DATE_FORMAT);
    const today = new Date();
    const oneYearPrior = `${today.getFullYear() - 1}-${today.getMonth() + 1}-${today.getDate()}`;

    let params = {
      fields: `name,fan_count,cover{source},picture.width(1000).height(1000),username,posts.limit(${feedLimit}).since(${oneYearPrior}).until(${todayDate}){comments.summary(1),shares,message,created_time,attachments{media,media_type,type,url},from,permalink_url,reactions.type(LIKE).limit(0).summary(1).as(like),reactions.type(LOVE).limit(0).summary(1).as(love),reactions.type(HAHA).limit(0).summary(1).as(haha),reactions.type(WOW).limit(0).summary(1).as(wow),reactions.type(SAD).limit(0).summary(1).as(sad),reactions.type(ANGRY).limit(0).summary(1).as(angry)}`
    }


    const fbResponse = await fbGraphApiClient.get(`${profile['social_page_id']}`, { params });
    const pageData = fbResponse.data;
    const pageFeedData = pageData.posts;
    const dateToday = moment().tz(`${configs.profileUpdateTimezome}`).format('YYYY-MM-DD');

    profile['page_name'] = pageData['name'];
    profile['page_username'] = pageData['username'] ? pageData['username'] : '';
    profile['page_picture'] = pageData['picture'] ? pageData.picture.data['url'] : '';
    profile['page_cover'] = pageData['cover'] ? pageData.cover['source'] : '';
    profile['page_fan_count'] = pageData['fan_count'];
    profile['last_updated_date'] = dateToday;
    profile['is_data_downloading'] = false;

    /* Saving the modal instance */
    await profile.save();

    /* Saving profile fan count*/
    const currentDate = format(new Date(), Enums.DATE_FORMAT);
    let previousDate = format(addDays(new Date(currentDate), -1), Enums.DATE_FORMAT);

    const prevFanGrowth = await Models.FacebookProfileFanGrowth.findOne({
      profile_id: profile['social_page_id'],
      date: previousDate
    })
    const previousFanCount = !prevFanGrowth ? 0 : prevFanGrowth.fan_count;
    const fanGrowth = previousFanCount == 0 ? 0 : pageData['fan_count'] - previousFanCount;

    await Models.FacebookProfileFanGrowth.findOneAndUpdate(
      {
        profile_id: profile['social_page_id'],
        date: currentDate,
      },
      {
        fan_count: pageData['fan_count'],
        date: currentDate,
        fan_growth: fanGrowth,
      },
      {
        new: true,
        upsert: true, // Make this update into an upsert
      },
    );

    if (pageFeedData.data.length > 0) {
      await saveProfileFeeds(pageFeedData, profile, feedLimit);
    }

    return;
  },
  getPublicProfiles: async (query) => {
    const responseData = []

    /* fetching the profiles matching query string*/
    let fbResponse = await fbGraphApiClient.get(`pages/search?q=${query}`);


    /* Extracting only page ids from search result */
    const matchedProfileIds = fbResponse.data ? fbResponse.data.data.map(item => item.id).join(",") : null


    /* In case of no matched result*/
    if (!matchedProfileIds) {
      return responseData
    }

    /* fetching name,picture and fan_count of multiple profils*/
    let params = {
      ids: `${matchedProfileIds}`,
      fields: `name,username,fan_count,picture.width(1000).height(1000)`
    }

    fbResponse = await fbGraphApiClient.get(``, { params });

    for (const key in fbResponse.data) {
      if (Object.hasOwnProperty.call(fbResponse.data, key)) {
        const profileIdData = fbResponse.data[key];

        responseData.push({
          id: profileIdData.id,
          name: profileIdData.name,
          fan_count: profileIdData.fan_count,
          profile_picture_url: profileIdData.picture ? (profileIdData.picture.data ? (profileIdData.picture.data.url) : "") : "",
          username: profileIdData.username ? profileIdData.username : ''
        })
      }
    }

    return responseData
  },

  testSearch: async (query) => {
    /* fetching the profiles matching query string*/
    let fbResponse = await fbGraphApiClient.get(`pages/search?q=${query}`);
    return fbResponse.data
  }
}