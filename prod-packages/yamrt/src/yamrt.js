'use strict';

const path = require('path');
const meow = require('meow');
const shellExec = require('shell-exec');

const _ = require('lodash');

const chalk = require('chalk');

const semver = require('semver');

const cli = meow({
        help: `
        Usage
          $ yamrt <path> <options>

        Path
          Root directory of monorepo directory structure. 

        Options
          --publish             Publish packages.
          --dryrun              Run to the end without doing any permanent damage, such as publishing pacakges.
          --force               Force publishing over normal objections. Has no effect if current version already published.           
          --verifyModified      Run verification script on modified packages. For npm packages, this is prepublishOnly.
          --gitBranch <branch>  Specify git branch name being built. Useful when source is checked out detached HEAD as 
                                is often the case in CD/CD build agents.                   
          --showIgnored         yamrt is silent by default about ignored projects. Set this flag to change that.
          --debug               Debug output.
          
        Package json configuration options.
        
        "yamrtConfig": {
            "publish":true/false    // Publish project in monorepo    
        }
        
        Package json configuration options can also be placed in a separate file called yamrt.json in the same directory.
        It can contain the same options as can be placed in in the "yamrtConfig" object documented above.
          
        IMPORTANT: Will publish only from git master branch with clean index and all changes pushed, unless --force is used.   

        Examples
          $ yamrt . --publish --dryrun           # See what would be published.
    `
    },
    {
        booleanDefault: undefined,
        flags: {
            publish: {
                type: 'boolean',
                default: false,
                alias: 'p'
            },
            dryrun: {
                type: 'boolean',
                default: false
            },
            force: {
                type: 'boolean',
                default: false
            },
            debug: {
                type: 'boolean',
                default: false,
                alias: 'd'
            },
            gitBranch: {
                type: 'string',
                default: false,
                alias: 'gb'
            },
            verifyModified: {
                type: 'boolean',
                default: false,
                alias: 'v'
            },
            showIgnored: {
                type: 'boolean',
                default: false,
                alias: 'si'
            }
        }
    });

const options = {
    cwd: path.resolve(cli.input[0] || (process.cwd())),
    publish: cli.flags.publish,
    dryRun: cli.flags.dryrun,
    debug: cli.flags.debug,
    force: cli.flags.force,
    verifyModified: cli.flags.verifyModified,
    gitBranch: cli.flags.gitBranch,
    showIgnored: cli.flags.showIgnored
};

if (options.debug) {
    console.debug = console.log;
} else {
    console.debug = () => {};
}

console.debug('yamrt flags: ', cli.flags);

if (options.help) {
    console.debug('Help shown, exiting');
    return process.exit(0);
}

console.debug(`Running YAMRT with options ${JSON.stringify(options, null, 2)}`);

const scanDirs = require('./scanDirectory');
const addPackageJson = require('./package-augment/loadPackageJson');
const npmjs = require('./package-augment/get-npmjs-package-info');
const addGitSha = require('./package-augment/addGitSha');
const addGitStatus = require('./package-augment/addGitState');
const addYamrtConfig = require('./package-augment/addYamrtConfig');

let augmentPackageJson = (packageJsonDir) => {
    return Promise.resolve(packageJsonDir).then(addPackageJson).then(addYamrtConfig).then(addGitSha).then(npmjs).then(addGitStatus);
};

let loadPackageJson = (packageDirs) => {
    return Promise.all(_(packageDirs).map(augmentPackageJson).value());
};

let leaveOnlyPackageJsonDirs = (dirs) => dirs.filter((dir) => dir.hasPackageJson);

const indent = '    ';

const indentedOutput = (outputString) => {
    console.log(indent + outputString);
};

let exitCode = 0;

function checkProjectGitStatus (project, branchName) {
    let gitStatusAllowsPublish = true;
    let gitStatusMessage = '';
    if (project.gitStatus) {
        let gitBranch = branchName || project.gitStatus.branch;
        if (gitBranch !== 'master') {
            gitStatusAllowsPublish = false;
            gitStatusMessage = `Not on master branch (${gitBranch}), will only publish from master branch.`;
        } else if (project.gitStatus.modified) {
            gitStatusAllowsPublish = false;
            if (project.gitStatus.ahead) {
                gitStatusMessage = 'Unpushed changes in project. Execute git status for details.';
            } else {
                gitStatusMessage = 'Uncommitted changes in project. Execute git status for details.';
            }
        } else {
            gitStatusAllowsPublish = true;
        }
    } else {
        gitStatusMessage = 'No git status found';
        gitStatusAllowsPublish = false;
    }
    return {
        gitStatusAllowsPublish: gitStatusAllowsPublish,
        gitStatusMessage: gitStatusMessage
    };
}

shellExec('npm --version').then((versionOutput) => {
    const versionRequirement1 = '>=6.0.0';
    if (semver.satisfies(versionOutput.stdout, versionRequirement1)) {
        return options.cwd;
    } else {
        let message = `npm version ${version} is not usable by yamrt, it requires ${versionRequirement}`;
        console.log(message);
        process.exit(-1);
    }
}).then(scanDirs).then(leaveOnlyPackageJsonDirs).then(loadPackageJson).then((dirsWithPackageJson) => {
    const allExecutionPromises = [];
    _(dirsWithPackageJson).each((project) => {

        if (project.hasPackageJson && project.packageJson) {

            const yamrtConfig = project.yamrtConfig || project.packageJson.yamrtConfig;

            if(!yamrtConfig){ // Ignore all projects without a yamrtConfig
                return
            }

            if (yamrtConfig.ignore) {
                console.info(chalk.red(`${project.path}: ignore setting is obsolete. Projects are now ignored by default, you have to explicitly configure them to be published. In (${project.packageJson.name}@${project.packageJson.version}).`));
            }

            let projectPublish = !!(yamrtConfig && yamrtConfig.publish);

            if(!projectPublish){
                if(options.showIgnored ){
                    console.info(chalk.yellowBright(`${project.path} is not configured to be published (${project.packageJson.name}@${project.packageJson.version}).`));
                }
                return;
            }

            console.log(`${chalk.cyan(project.path)}`);

            project.gitPublishEffect = checkProjectGitStatus(project, cli.flags.gitBranch);

            if (project.npmJsPackage) {

                if (project.npmJsPackage['dist-tags']) {

                    const prefixedSha = 'YT' + project.dirGitSha;

                    let publishedSha = project.npmJsPackage && project.npmJsPackage['dist-tags'] && project.npmJsPackage['dist-tags'][prefixedSha];

                    console.debug('project.npmJsPackage[\'dist-tags\']', project.npmJsPackage['dist-tags']);
                    project.currentCommitAlreadyPublished = (!!publishedSha);

                    console.debug(`${project.path} currentCommitAlreadyPublished`, project.currentCommitAlreadyPublished);
                    console.debug(`${project.path} publishedSha`, publishedSha);
                    console.debug(`${project.path} prefixedSha`, prefixedSha);

                    project.latestPublishedVersion = project.npmJsPackage && project.npmJsPackage['dist-tags'] && project.npmJsPackage['dist-tags'].latest;
                    project.currentVersionAlreadyPublished = (project.latestPublishedVersion === project.packageJson.version);
                } else { // This is a case which arises with unpublished packages.
                    project.loadExceptions.push({
                        errorType: 'package-no-dist-tags',
                        error: new Error(`${project.path} (${project.packageJson.name}) -> npmjs.org package information has no dist-tags! `)
                    });

                    console.error('project.npmJsPackage\n', JSON.stringify(project.npmJsPackage));

                    project.currentCommitAlreadyPublished = false;
                    project.currentVersionAlreadyPublished = false;
                }
            } else {
                project.currentCommitAlreadyPublished = false;
                project.currentVersionAlreadyPublished = false;
            }

            indentedOutput(`${project.currentCommitAlreadyPublished ? 'Up to date' : 'Changes detected'} `);
            indentedOutput(`source ${project.packageJson.name}@${project.packageJson.version} | registry ${project.packageJson.name}@${project.latestPublishedVersion} `);

            if (project.gitPublishEffect.gitStatusMessage) {
                indentedOutput(chalk.yellow(project.gitPublishEffect.gitStatusMessage));
            }

            let installCmd = `npm install &&`;
            if (project.hasFile('package-lock.json')) {
                installCmd = 'npm ci &&';
            } else if (project.hasFile('yarn.lock')) {
                installCmd = 'yarn install --frozen-lockfile &&';
            }

            if (project.hasFile('node_modules')) {
                installCmd = '';
            }

            if (!project.currentVersionAlreadyPublished) { // version has changed

                project.willPublish = options.publish && projectPublish;

                if (project.currentCommitAlreadyPublished) {
                    project.willPublish = options.publish && options.force;
                }

                if (!options.force) {
                    project.willPublish = project.willPublish && project.gitPublishEffect.gitStatusAllowsPublish;
                }

                if (!project.willPublish && options.force) {
                    indentedOutput(chalk.yellow('Overriding non-publishable status with --force'));
                    project.willPublish = true;
                }
                if (options.publish && !project.willPublish && exitCode === 0) {
                    exitCode = -1; // Fail run due to non-publishable status.
                }

                const dryRunFlag = options.dryRun && ' --dry-run' || '';

                if (project.willPublish && options.publish) {


                    const prefixedSha = 'YT' + project.dirGitSha;
                    let publishCmd = `npm publish --tag ${prefixedSha} ${dryRunFlag} &&`;
                    let tagCmd = `npm dist-tag add ${project.packageJson.name}@${project.packageJson.version} latest  ${dryRunFlag}`;

                    let npmCommand = `cd ${project.path} && ${installCmd} ${publishCmd} ${tagCmd}`;
                    indentedOutput(indent + `Running command ${npmCommand}`);

                    allExecutionPromises.push(shellExec(npmCommand).then((execResult) => {
                        console.log(execResult.stdout);
                        if (execResult.code !== 0) {
                            exitCode = -10;
                            console.error(`Failed to publish ${project.path}!`);
                            console.error(execResult.stderr);
                        } else {
                            if (options.dryRun) {
                                indentedOutput(chalk.yellow(' --- dry-run ---'));
                            }
                            indentedOutput(`Published ${chalk.green(project.path)}`);
                        }
                    }));
                } // version has changed, will not publish, there is something to be done here. Redesign this code block, object functional way.
            } else { // version has not changed
                if (!project.currentCommitAlreadyPublished) { // Code has changed, version has not

                    const verifyFlagMessage = options.verifyModified && '--verifyModified flag set, running prepublishOnly' || '';
                    indentedOutput(chalk.green(`Code has changed since last publish, but version has not. ${verifyFlagMessage}`));

                    console.log('installCmd', installCmd);

                    if (options.verifyModified) {
                        let npmCommand = `cd ${project.path} && ${installCmd} npm run prepublishOnly`;
                        indentedOutput(indent + `Running command ${npmCommand}`);

                        allExecutionPromises.push(shellExec(npmCommand).then((execResult) => {
                            console.log(execResult.stdout);
                            if (execResult.code !== 0) {
                                exitCode = -10;
                                console.error(`Failed to build ${project.path}!`);
                                console.error(execResult.stderr);
                            } else {
                                indentedOutput(`Prepublish successful ${chalk.green(project.path)}`);
                            }
                        }));
                    }
                } else { // No changes
                    indentedOutput(`${chalk.yellow('No changes')}`);
                }
            }
        }


        if (project.isGitRepoDir) {
            console.debug(`${project.path} git status ${project.gitStatus}`);
        } else {
            console.debug(`${project.path} not a a git root directory ${JSON.stringify(project.gitStatus)}`);
        }

        if (project.loadExceptions.length) {
            indentedOutput(`${chalk.yellow('Exceptions occurred collecting information: ')}`);
            indentedOutput(_.map(project.loadExceptions, (err) => {
                return err.errorType + '  -> : ' + chalk.red(err.error && err.error.message || err.message);
            }).join('\n'));
            indentedOutput('');
        }
    });
    if (dirsWithPackageJson.length === 0) {
        console.log('No packages found to publish');
    } else {
        console.log('Found package count: ' + dirsWithPackageJson.length);
    }
    return Promise.all(allExecutionPromises);
}).then((allPublishResults) => {
    process.exit(exitCode);
});
