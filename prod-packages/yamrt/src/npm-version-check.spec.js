const expect = require('chai').expect;
const semver = require('semver');


describe('npm version check', function () {

    it('should return false on version 5', () => {
        expect(semver.satisfies('5.8.1', '>=6.0.0')).to.equal(false);

    });

    it('should be ok with version 6.4.2', () => {
        expect(semver.satisfies('6.4.2', '>=6.0.0')).to.equal(true);

    });
});