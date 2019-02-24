const path = require('path');

describe.only('git sha addition', function () {
    it('should add git sha to dir info object', () => {

        const relativePath = path.relative('.', __dirname)

        require('./addGitSha')({path:relativePath})
    });
});