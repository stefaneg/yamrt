const rc = require('rc');
const registryUrl = require('registry-url');
const request = require('superagent');
const url = require('url');

function registryPackage (name, callback) {

    const npmConf = rc('npm', {});
    let npmAuthenticationToken = npmConf['//registry.npmjs.org/:_authToken'];

    let packageInfoRequest = request.get(url.resolve(registryUrl(), name));

    if (npmAuthenticationToken) {
        packageInfoRequest.set('Authorization', `Bearer ${npmAuthenticationToken}`);
    }
    packageInfoRequest.end(function(err, response) {
        callback(err, response.body);
    });
}

module.exports = registryPackage;
