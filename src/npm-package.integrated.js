var expect = require('chai').expect;

const getNpmjsPackageInfo = require('./get-npmjs-package-info');

describe('npm package info from npm repository', () => {

    it('should get npmjs package info and add to structure', () => {

        const dirInfo = {
            name: 'npm-package-info',
            packageJson: {
                name: 'npm-package-info'
            }
        };

        return getNpmjsPackageInfo(dirInfo).then((dirInfoWithNpmJsPackage) => {
            // noinspection BadExpressionStatementJS
            expect(dirInfoWithNpmJsPackage.npmJsPackage.versions['0.0.1']).to.be.ok
            return dirInfoWithNpmJsPackage;
        });
    });

});

describe('npm publishing with directory git SHA', function () {

});