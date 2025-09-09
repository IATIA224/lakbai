// Simple mock for any imported CSS file
module.exports = new Proxy({}, {
    get: () => '',
});