const path = require('path');
const _ = require('lodash');

describe.only('YAMRT command line', function () {

    if (!global.originalArgv) {
        global.originalArgv = process.argv;
    }
    beforeEach(() => {
        process.argv = _.clone(global.originalArgv);
    });

    it.skip('should display help message and exit (need to test this differently)', () => {
        process.argv.push('--help');
        require('./yamrt');
    });

    it('should scan monorepo', () => {
        // TODO: Package and publish plugins as NPM packages and use for in
        const monorepoRootPath = path.resolve(path.join(__dirname, '..'));
        process.argv.push(monorepoRootPath);
        process.argv.push('--dryrun');
        process.argv.push('--debug');
        require('./yamrt');
    });

});