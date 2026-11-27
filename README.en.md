# Diana live-room like helper

A Chrome and Edge extension (Chrome 105+) for [Diana's Bilibili live room](https://live.bilibili.com/22637261). Open the popup while you are in the room, click **Authorize and start**, and the extension presses the page's own like button the number of times you asked for.

[简体中文](README.md) · MIT

## Install and use

1. On the GitHub repository, click **Code → Download ZIP**, then unzip it.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge. Turn on **Developer mode**, choose **Load unpacked**, and select the `extension` folder you just unzipped.
3. Sign in to Bilibili and open Diana's live room. Open the extension from the browser toolbar.
4. Enter how many times this round should press the button, then click **Authorize and start**. The default is 5; you can choose 1 to 30. The first press happens as soon as the button is ready, and later presses are 3 seconds apart.
5. Closing the popup does not stop the round. Open it again to watch progress or click **Stop this round**. Reloading, closing or leaving the room ends the round, and the next one needs a fresh authorization.

If the like button has not rendered yet, the extension waits up to 15 seconds. If the button disappears or becomes unavailable after the first press, the round stops. The popup counts presses it triggered; the like count Bilibili records is whatever the room displays.

## Please read: risk

This is a third-party fan project. It is not affiliated with, authorized by, or endorsed by Bilibili or Diana.

Bilibili's terms of service prohibit scripts or tools that perform interactions automatically. This extension presses the page's native button at a human-like pace (3 seconds apart, at most 30 times per round), but it is still automation, and **your account could have features restricted or be penalized**. Decide for yourself whether to use it.

The popup counts presses it triggered, which may not match the like count the room shows. Please do not raise the limit or shorten the interval to go faster — that makes rate limiting and detection considerably more likely.

## Permissions and data

The extension requests `activeTab` and `scripting`. When the popup opens it first checks the URL of the active tab and only injects the script if the room id matches `22637261`. Presses only target the native like button in the room's chat area. The round state and progress live in the tab's memory; signing in and reporting likes are handled by Bilibili's own page.

This is an independent open-source fan project, released under the [MIT license](LICENSE).

## Development

The extension sources are in `extension` and can be loaded directly. Run the tests with Node.js 22 or newer; there is nothing to install.

```sh
node --test
```

The popup distinguishes controls still loading, unrecognized button markup, a currently unavailable button and a stopped round. The tests cover these paths with a simulated page and clock. If Bilibili changes the live room markup, start with the selector in `extension/session.js`.
