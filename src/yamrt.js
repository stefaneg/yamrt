'use strict';

console.log('ARGV', process.argv)

const meow = require('meow');
const isCI = require('is-ci');
// const createCallsiteRecord = require('callsite-record');
// const pkg = require('../package.json');
// const npmCheck = require('./index');
// const staticOutput = require('./out/static-output');
// const interactiveUpdate = require('./out/interactive-update');
// const updateAll = require('./out/update-all');
// const debug = require('./state/debug');
const pkgDir = require('pkg-dir');
// const detectPreferredPM = require('preferred-pm');
const _ = require('lodash')

const cli = meow({
        help: `
        Usage
          $ yamrt <path> <options>

        Path
          Root directory of monorepo directory structure.

        Options
          --debug               Debug output.
          --dryrun              Run to the end without doing any permanent damage, such as publishing pacakges.
          --all-packages        Ignore modification detection and execute on all found packages.           

        Examples
          $ yamrt . publish --dryrun           # See what would be published.
    `},
    {
        booleanDefault: undefined,
        flags:{
            publish:{
                type:'boolean',
                default: false,
                alias:'p'
            },
            dryrun:{
                type:'boolean',
                default:false,
                alias:'dr'
            },
            debug:{
                type:'boolean',
                default:false,
                alias:'d'
            },
            package:{
                type:'string',
                default:'',
                alias:'pkg'
            },
        }
    });



const options = {
    cwd: cli.input[0] || (pkgDir.sync() || process.cwd()),
    publish: cli.flags.publish,
    dryRun: cli.flags.dryrun,
    debug: cli.flags.debug
};

if(options.debug){
    console.debug = console.log
} else {
    console.debug = ()=>{}
}

console.log('Running MRT with options', options);

const scanDirs = require('./scanDirectory');
const addPackageJson = require('./package-augment/loadPackageJson');
const npmjs = require('./get-npmjs-package-info');

let augmentPackageJson = (packageJsonDir)=>{
    console.log('Augmenting...', packageJsonDir);
    return Promise.resolve(packageJsonDir).then(addPackageJson).then(npmjs)
};

let loadPackageJson = (packageDirs)=>{
    return Promise.all( _(packageDirs).map(augmentPackageJson).value());
};

let onlyPackageJsonDirs = (dirs)=>dirs.filter((dir)=>dir.containsPackageJson);

scanDirs(options.cwd).then(onlyPackageJsonDirs).then(loadPackageJson).then((dirsWithPackageJson)=>{
    console.log("Found package count: ", dirsWithPackageJson.length)
    console.log("DirsWithPackages", dirsWithPackageJson)
    _(dirsWithPackageJson).each((project)=>{
         if(project.packageJson.name){
             console.debug('Checking', project.packageJson.name)
         }
    })
});
