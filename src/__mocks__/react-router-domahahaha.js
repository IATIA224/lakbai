const React = require("react");

module.exports = {
    ...jest.requireActual("react-router-dom"),
    useLocation: jest.fn().mockReturnValue({ pathname: "/" }),
    useNavigate: jest.fn(),
    Routes: ({ children }) => <>{children}</>,
    Route: ({ element }) => element,
};
