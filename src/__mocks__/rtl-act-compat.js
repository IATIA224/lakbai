// Map Testing Library's act-compat to React.act to avoid deprecation warning
const React = require('react');
module.exports = { act: React.act };