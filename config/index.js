const dotenv = require('dotenv');
dotenv.config();
module.exports = {
    appPort: process.env.APP_PORT,
    dbMysqlHost: process.env.DB_MYSQL_HOST,
    dbMysqlPort: process.env.DB_MYSQL_PORT,
    dbMysqlDialect: process.env.DB_MYSQL_DIALECT,
    dbMysqlDatabase: process.env.DB_MYSQL_DATABASE,
    dbMysqlUsername: process.env.DB_MYSQL_USERNAME,
    dbMysqlPassword: process.env.DB_MYSQL_PASSWORD,
    fbGraphApiBaseURL: process.env.FB_GRAPH_API_BASE_URL,
    fbMsvAppToken: process.env.FB_MSV_APP_TOKEN,
    fbUserAccessToken: process.env.FB_USER_ACC_TOK,
    mongoDbConnectionURL: process.env.MONGO_DB_CONNECTION_URL,
    profileUpdateInterval: process.env.PROFILE_UPDATE_INTERVAL,
    profileFeedsNextPageRequestInterval: process.env.PROFILE_FEEDS_NEXT_PAGE_REQUEST_INTERVAL,
    socialMediaProfileUpdateMode: process.env.SOCIAL_PROFILE_UPDATE_MODE,
    profileUpdateTimezome: process.env.PROFILE_UPDATE_TIMEZOME,
};
