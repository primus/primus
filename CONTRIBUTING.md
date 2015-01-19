# Contributing

We welcome and encourage community contributions to our projects. This document
specifies the guidelines for contributing to the projects that are created under
the **primus** organization. We've split this document in smaller sections:

- [Feature Requests](#feature-requests)
- [Questions](#questions)
- [Issues](#issues)
  - [Outline of a good bug report](#outline-of-a-good-bug-report)
  - [Labels](#labels)
- [Code](#code)
  - [The Boy Scout Rule](#the-boy-scout-rule)
  - [Developer's Certificate of Origin](#developers-certificate-of-origin)
- [Code of Conduct](#code-of-conduct)

There are always many ways you can help out this project besides contributing
to the code:

- Writing and improving our documentation.
- Helping people out in our [IRC][irc] room.
- Searching for potential memory leaks, event loops blocks and de-optimized
  code.
- Preforming security audits on the code base. Please check our
  [SECURITY.md](security) for the Security Guidelines.
- Filing bugs.

And that list goes on and on. No matter what you choose we are thankful for your
interest and for the fact that you want to contribute to our projects. They are
build and maintained with love and we hope to share some of that love with you.

## Feature Requests

Yes! Make them! We would love to hear your idea(s) and what we can do to continue
to move this project forward. Changes, big or small, are always welcomed. If the
feature requested is not in line with our roadmap we will work with you to
ensure that you can build it yourself on top of our project.

## Questions

When you're first starting you're bound to have questions about this project. We
hope that our documentation in the [README.md][readme] provides answers to all
your questions. In rare cases when the documentation does not answer your
question you could:

1. Join our [IRC][irc] room and ask the question there. The authors,
   contributors and users of this project usually hang around there.
2. By creating an issue on GitHub. Throughly explain your issue, the more
   information you provide us with the better we can help you.

We will do our best to answer your questions in a timely manner. Please note
that if you create an new issue by stuffing the question in the title and no
explanation in the body it will be closed and locked immediately and referred
to this contribution file.

## Issues

**If you have a security related issue, please review [Security
Guidelines][security] first.**

Before creating an issue make sure that you are using the latest version of the
module as the issue you report could be already resolved. If you are using the
latest version please use the Github search feature to check if the issue is
already known. If you've found an issue that is:

- **closed:** Check if the issue provides a solution for your issue. If it's
  already fixed using a commit it could be that there have been a regression in
  the code. In this case it's best to open a new issue. For all other cases it
  might make more sense to just add comment to the closed issue explaining that
  you're still affected by this.
- **open:** Try to provide more details to the issue. If you can reproduce the
  issue in a different way then the one used by the original author, please add
  this. The more ways we have to reproduce the bug, the more are the chances to
  get it fixed fast.
- **missing:** Please open a new issue, we would love to hear more about it.

### Outline of a good bug report

When reporting new issues for the project please use the following issue
template so you know what kind of data you need to supply and we can resolve it
as quickly as possible. If some of these fields do not apply to your issue feel
free to leave them empty or remove them completely:

```
**Version:**

**Environment:**
  - **Operating system**:
  - **browser**:
  - **Nodejs**:
  - **npm**:

**Expected result:**

**Actual result:**

**Steps to reproduce:**

1. Step 1.
2. Step 2.
3. Things are broken.
```

Here is a small explanation of the fields and what kind of information could be
present in them.

- **Version:** The version number of the module that you're currently using. If
  you don't know the current version number you can check it by running `npm ls`
  in your terminal.
- **Environment:** This allows us to narrow down the issue to a potential platform
  or version if we cannot reproduce it on our own machines. If you don't know
  your npm and node.js version you can run `npm version` in your terminal and it
  will output all the information you need. If you are reporting a node.js
  specific bug you can omit the browser field unless it requires a browser to
  reproduce it.
- **Expected result:** What did you expect would happen.
- **Actual result:** What actually happened when you executed the code.
- **Steps to reproduce:** Every step to fully reproduce the issue is described
  here, no matter how small. You cannot be specific enough. It's better to have
  too much details than too few here.

A complete example of this would be:

```
Version: 0.0.1
Environment:
  - Operating System: Mac OSX 10.10.1 (14B25)
  - Node: 0.10.31
  - npm: 1.4.28
  - browser: Google Chrome, Version 39.0.2171.71 (64-bit)

Expected result: A `console.log` message in the terminal.

Actual result: An empty console without any log messages.

Steps to reproduce:

1. Open Chrome.
2. Open the Developer tools panel.
3. Type `console.log('message')`.
4. Press enter to execute the code.
```

When adding code to your example please use [code fencing][fencing] to ensure
that your snippet is highlighted correctly. This greatly improves the
readability of the issue.

### Labels

We try to label all created issues to facilitate the identification of the
issue scope. We also label all issues with a `★`. The more stars an issue has
the more important it is. We currently have three different levels of
importance:

- **`★★★`**: High priority issue, should be addressed as soon as possible. We
  will do our best to include this in the next release. This however does not
  mean that no issue is closed or fixed before these high priority issues.
- **`★★`**: Medium priority, this should be fixed but it might not make the next
  release.
- **`★`**: Low priority issue, don't expect this to be resolved soon. These bugs
  are generally fixed on a rainy or boring day. These bugs are also great
  for first time contributors who are looking for something to fix.

## Code

Unless you are fixing a known bug we **strongly** encourage to discuss your
feature with the core team via a GitHub issue or [IRC][irc]. Before getting
started ensure that you work will not rejected.

All contributions must be made via pull requests. After a pull request is made
other contributors will either provide feedback or merge it directly depending
on:

- Addition of new tests and passing of the test suite.
- Code coverage.
- The severity of the bug that the code is addressing.
- The overall quality of patch.

We expect that every bug fix comes with new tests for our test suite. This is
important to prevent regression in the future as our current set of tests did
not trigger the code path.

### The Boy Scout Rule

When working with the code try to follow the rule that The Boy Scouts have:

> Always leave the campground cleaner than you found it.

If you find a mess on the ground, you clean it up regardless of who might have
made the mess. You intentionally improve the environment for the next group of
campers. Working with code should not be an exception to this. If you find
a mess in the code, clean it up no matter who the original author was.

### Developer's Certificate of Origin

All contributors must agree to the [Developers Certificate of Origin][dco]:

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
660 York Street, Suite 102,
San Francisco, CA 94110 USA

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

To accept the DCO, add the following line to each commit message with your name
and email address:

```
Signed-off-by: Joe Longpolland <joe@example.com>
```

You can automate this process by simply committing your code using the `-s`
option:

```
git commit -s
```

For legal reasons we cannot accept anonymous, pseudonymous or nick names. If
this is an issue please contact us directly through [IRC][irc].

## Code of Conduct

- We are committed to providing a friendly, safe and welcoming environment for
  all, regardless of gender, sexual orientation, disability, ethnicity, religion,
  or similar personal characteristic.
- Please avoid using overtly sexual nicknames or other nicknames that might
  detract from a friendly, safe and welcoming environment for all.
- Please be kind and courteous. There's no need to be mean or rude.
- Respect that people have differences of opinion and that every design or
  implementation choice carries a trade-off and numerous costs. There is seldom a
  right answer.
- Please keep unstructured critique to a minimum. If you have solid ideas you
  want to experiment with, make a fork and see how it works.
- We will exclude you from interaction if you insult, demean or harass anyone.
  That is not welcome behaviour. We interpret the term "harassment" as including
  the definition in the Citizen Code of Conduct; if you have any lack of clarity
  about what might be included in that concept, please read their definition. In
  particular, we don't tolerate behavior that excludes people in socially
  marginalized groups.
- Private harassment is also unacceptable. No matter who you are, if you feel
  you have been or are being harassed or made uncomfortable by a community
  member, please contact one of the channel ops or any of the core contributors
  immediately with a capture (log, photo, email) of the harassment if possible.
  Whether you're a regular contributor or a newcomer, we care about making this
  community a safe place for you and we've got your back.
- Likewise any spamming, trolling, flaming, baiting or other attention-stealing
  behaviour is not welcome.

[dco]: http://elinux.org/Developer_Certificate_Of_Origin
[irc]: http://webchat.freenode.net/?channels=primus
[fencing]: https://help.github.com/articles/github-flavored-markdown/#fenced-code-blocks
[security]: SECURITY.md
[readme]: README.md
