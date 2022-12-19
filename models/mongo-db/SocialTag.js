const mongoose = require('mongoose');

const SocialTagSchema = new mongoose.Schema(
    {
        query_tag: {
            type: String,
            required: true,
        },
        social_type: {
            type: String,
            required: true,
        },
    },
    {timestamps: true},
);

const SocialTag = mongoose.model('SocialTags', SocialTagSchema);

module.exports = SocialTag;
