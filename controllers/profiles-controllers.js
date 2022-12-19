const Services = require('../services');
const Models = require('../models/mongo-db').default;
const { fetchLeastUpdatedProfileNdUpdate } = require('../profile-updater');

module.exports = {
    store: async (req, res, next) => {
        try {
            const reqProfile = req.body;
            console.log(req.body);
            const socialProfile = await Models.SocialMediaProfile.findOne({
                social_page_id: reqProfile.social_page_id,
                social_type: reqProfile.social_type,
            });

            /* Sending profile to profile-updater module */
            fetchLeastUpdatedProfileNdUpdate(socialProfile);

            res.send('respond with a resource');
        } catch (error) {
            const { response } = error;
            logger.error(`error response >> ${response} `);
            res.send('respond with a resource');
        }
    },
    pull: async (req, res, next) => {
        try {
            const reqProfile = req.params;
            const socialProfile = await Models.SocialMediaProfile.findOne({
                social_page_id: reqProfile.profile_id,
                social_type: 'facebook',
            });

            /* Sending profile to profile-updater module */
            Services.FacebookProfileService.createOrUpdateProfile(socialProfile);

            res.send('respond with a resource');
        } catch (error) {
            const { response } = error;
            logger.error(`error response >> ${response} `);
            res.send('respond with a resource');
        }
    },
    searchSocialMediaProfiles: async (req, res, next) => {
        try {
            const reqParams = req.params;

            socialMediaProfilesRes = await Services.FacebookProfileService.getPublicProfiles(reqParams.query);

            res.status(200).json({
                socialMediaProfiles: socialMediaProfilesRes,
            });
        } catch (error) {
            console.log(error);
            res.status(200).json({
                socialMediaProfiles: [],
            });
        }
    },
    searchHashtag: async (req, res, next) => {
    },

    testSearchSocialMediaProfiles: async (req, res, next) => {
        try {
            const reqParams = req.params;

            let socialMediaProfilesRes = await Services.FacebookProfileService.testSearch(reqParams.query);
            console.log(socialMediaProfilesRes)
            return res.status(200).json(socialMediaProfilesRes);
        } catch (error) {
            console.log(error);
        }
    },
};
