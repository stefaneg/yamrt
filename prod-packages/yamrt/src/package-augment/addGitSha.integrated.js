const path = require('path');

describe('git sha addition', function () {
    it('should add git sha to dir info object for current dir', () => {
        const relativePath = path.relative('.', __dirname);
        require('./addGitSha')({path: relativePath});
    });

    it('should add git sha to dir info object', () => {
        const relativePath = './src';
        require('./addGitSha')({path: relativePath});
    });
});