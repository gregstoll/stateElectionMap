var path = require('path');

module.exports = {
module = {
    rules: [{
        test: /\.html$/,
        use: [{
            loader: "html-loader",
            options: {
                minimize: true,
                removeComments: false,
                collapseWhitespace: false
            }
        }],
    }]
};
