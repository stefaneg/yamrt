## CircleCI build status

[![CircleCI](https://circleci.com/gh/stefaneg/yamrt.svg?style=svg)](https://circleci.com/gh/stefaneg/yamrt)

# YAMRT - YetAnotherMonoRepoTool

YAMRT is a mono repo tool that is focused on a CI/CD workflow that allows developers to treat
individual projects inside the monorepo as if they were in independent repositories as much as 
possible, but at the same time leverage the monorepo to streamline build, inspect, test and 
publishing of artifacts in a single uniform CI/CD pipeline. That means that artifacts in a 
single monorepo should have little variation in the way they are built and published. 
For instance, your published npm packages would be in one repository, while your published
docker images would be in another.

## Why another monorepo tool

Other tools that were researched, such as Lerna, are designed for an interactive workflow with
git commit and push after publishing. In short, I could not find a tool that allows the workflow
experience I was seeking, 

## What does it do differently

One design goal of YAMRT is to track the relationship between published artifact and code changes
without the need to push changes back to git. YAMRT instead relies on the artifact repository, 
such as npmjs.org, to store a hash from the state of individual projects. The build and publish
decision is made by checking if the current hash of the project has been published or not, and
by checking if the semantic version of the published artifact has been changed or not.

If the semantic version has changed, publish is executed. If only the hash has changed,
the build target is executed, which is prepublishOnly in the npm case. If neither is changed,
nothing happens.

## Install

```
npm install yamrt
```

Explore usage: 
```
yamrt --help
```

### TODO

- Design console output more carefully.
- Refactor yamrt file and start unit testing :-)
- Detect package manager to use.
- Extract project scanning, hash retrieval and publish into a plugin.
- Write dockerfile detection, build and publish plug in.
   - Consider adding docker tag directives to dockerfile if missing.
- Emit information about published packages in a structured way.
- Implement configuration
  - Cache location
  - Package manager to use - override detection.
- cache registry metadata, and fetch from origin if hash of current version has NOT been published.
  
#### Ideas:


## CI/CD setup

