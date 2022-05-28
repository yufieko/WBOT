const puppeteer = require('puppeteer-core');
const _cliProgress = require('cli-progress');
const spintax = require('mel-spintax');
const { Client, LocalAuth } = require('whatsapp-web.js');
require("./welcome");
var spinner = require("./step");
var utils = require("./utils");
var qrcode = require('qrcode-terminal');
var path = require("path");
var argv = require('yargs').argv;
var rev = require("./detectRev");
var constants = require("./constants");
var configs = require("../bot");
var fs = require("fs");
const fetch = require("node-fetch");
const { lt } = require('semver');
const mime = require('mime');

//console.log(ps);


//console.log(process.cwd());

async function Main() {

    try {
        //console.log(configs);
        var page;
        await downloadAndStartThings();
        // var isLogin = await checkLogin();
        // if (!isLogin) {
        //     await getAndShowQR();
        // }
        // if (configs.smartreply.suggestions.length > 0) {
        //     await setupSmartReply();
        // }
        // await setupPopup();
        await checkForUpdate();
        console.log("WBOT is ready !! Let those message come.");
    } catch (e) {
        console.error("\nLooks like you got an error. " + e);
        try {
            page.screenshot({ path: path.join(process.cwd(), "error.png") })
        } catch (s) {
            console.error("Can't create shreenshot, X11 not running?. " + s);
        }
        console.warn(e);
        console.error("Don't worry errors are good. They help us improve. A screenshot has already been saved as error.png in current directory. Please mail it on vasani.arpit@gmail.com along with the steps to reproduce it.\n");
        throw e;
    }

    /**
     * If local chrome is not there then this function will download it first. then use it for automation. 
     */
    async function downloadAndStartThings() {
        let botjson = utils.externalInjection("bot.json");
        var appconfig = await utils.externalInjection("bot.json");
        appconfig = JSON.parse(appconfig);
        spinner.start("Downloading chromium\n");
        const browserFetcher = puppeteer.createBrowserFetcher({ platform: process.platform, path: process.cwd() });
        const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_grey);
        progressBar.start(100, 0);
        //var revNumber = await rev.getRevNumber();
        const revisionInfo = await browserFetcher.download("982053", (download, total) => {
            //console.log(download);
            var percentage = (download * 100) / total;
            progressBar.update(percentage);
        });
        progressBar.update(100);
        spinner.stop("Downloading chromium ... done!");
        //console.log(revisionInfo.executablePath);
        spinner.start("Launching browser\n");
        var pptrArgv = [];
        if (argv.proxyURI) {
            pptrArgv.push('--proxy-server=' + argv.proxyURI);
        }
        const extraArguments = Object.assign({});
        extraArguments.userDataDir = constants.DEFAULT_DATA_DIR;
        // const browser = await puppeteer.launch({
        //     executablePath: revisionInfo.executablePath,
        //     defaultViewport: null,
        //     headless: appconfig.appconfig.headless,
        //     userDataDir: path.join(process.cwd(), "ChromeSession"),
        //     devtools: false,
        //     args: [...constants.DEFAULT_CHROMIUM_ARGS, ...pptrArgv], ...extraArguments
        // });

        const client = new Client({
            puppeteer: {
                executablePath: revisionInfo.executablePath,
                defaultViewport: null,
                headless: appconfig.appconfig.headless,
                devtools: false,
                args: [...constants.DEFAULT_CHROMIUM_ARGS, ...pptrArgv], ...extraArguments
            }
        });
        if (argv.proxyURI) {
            spinner.info("Using a Proxy Server");
        }

        client.on('qr', (qr) => {
            // Generate and scan this code with your phone
            console.log('QR RECEIVED', qr);
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', async () => {
            spinner.info('WBOT is spinning up!');
            await utils.delay(5000)
            //TODO: if replyUnreadMsg is true then get the unread messages and reply to them.
        });

        client.on('authenticated', () => {
            spinner.info('AUTHENTICATED');
        });

        client.on('auth_failure', msg => {
            // Fired if session restore was unsuccessful
            console.error('AUTHENTICATION FAILURE', msg);
            // process.exit(1);
        });

        client.on('message', async msg => {
            console.log(msg.body)
            let chat = await client.getChatById(msg.from)
            console.log(`Message ${msg.body} received in ${chat.name} chat`)
            if (msg.body == '!ping') {
                msg.reply('pong');
            }
            // if it is a media message then download the media and save it in the media folder
            if (msg.hasMedia && configs.appconfig.downloadMedia) {
                console.log("Message has media. downloading");
                const media = await msg.downloadMedia()
                // checking if director is present or not
                if (!fs.existsSync(path.join(process.cwd(), "media"))) {
                    fs.mkdirSync(path.join(process.cwd(), "media"));
                }

                // write the data to a file
                let extension = mime.getExtension(media.mimetype)
                fs.writeFileSync(path.join(process.cwd(), "media", msg.from + msg.id.id + "." + extension), media.data, 'base64')
                console.log("Media has been downloaded");
            } else {
                console.log("Message doesn't have media or it is not enabled in bot.config.json");
            }

            //TODO: reply according to the bot.config.json


            //TODO: call the webhook 


        });


        await client.initialize();

        spinner.stop("Launching browser ... done!");

        // When the settings file is edited multiple calls are sent to function. This will help
        // to prevent from getting corrupted settings data
        let timeout = 5000;

        // Register a filesystem watcher
        fs.watch(constants.BOT_SETTINGS_FILE, (event, filename) => {
            setTimeout(() => {
                console.log("Settings file has been updated. Reloading the settings");
                configs = JSON.parse(fs.readFileSync(path.join(process.cwd(), "bot.json")));
            }, timeout);
        });

        // page.exposeFunction("getFile", utils.getFileInBase64);
        // page.exposeFunction("saveFile", utils.saveFileFromBase64);
        // page.exposeFunction("resolveSpintax", spintax.unspin);
    }
}

// async function injectScripts(page) {

//     return await page.waitForSelector('[data-icon=laptop]')
//         .then(async () => {
//             var filepath = path.join(__dirname, "WAPI.js");
//             await page.addScriptTag({ path: require.resolve(filepath) });
//             filepath = path.join(__dirname, "inject.js");
//             await page.addScriptTag({ path: require.resolve(filepath) });
//             return true;
//         })
//         .catch(() => {
//             console.log("User is not logged in. Waited 30 seconds.");
//             return false;
//         })
// }

// async function AddCustomJsFiles(page) {

//     //check if appconfig.appconfig.CustomInjectionFolder has something in it otherwise call this entire thing off

//     spinner.info('Adding Custom Js Files')
//     let appconfig = JSON.parse(await utils.externalInjection("bot.json"))
//     // console.log(appconfig)
//     if (appconfig.appconfig.CustomInjectionFolder) {
//         try {
//             const directoryPath = path.resolve(appconfig.appconfig.CustomInjectionFolder);
//             // console.log(directoryPath);
//             const folder = fs.readdirSync(directoryPath)
//             if (!folder) {
//                 return console.log('Unable to scan directory: ' + err);
//             } else {
//                 folder.forEach(async function (file) {
//                     // spinner.start(`Load ${file} file in browser`);
//                     //console.log(revisionInfo.executablePath);
//                     var filepath = directoryPath + '/' + file;
//                     await page.addScriptTag({ path: require.resolve(filepath) });
//                     // console.log(`Load ${file} file in browser ... done`);
//                     spinner.info(`Load ${file} file in browser ... done!`);
//                     // console.log(file);
//                 });
//             }
//         } catch (e) {
//             spinner.info('Path not found')
//             console.error(e)
//         }
//     } else {
//         spinner.info('No files to inject')
//     }
// }

// async function checkLogin() {
//     spinner.start("Page is loading");
//     //TODO: avoid using delay and make it in a way that it would react to the event. 
//     await utils.delay(10000);
//     //console.log("loaded");
//     var output = await page.evaluate("localStorage['last-wid']");
//     //console.log("\n" + output);
//     if (output) {
//         spinner.stop("Looks like you are already logged in");
//         await AddCustomJsFiles(page);
//         await injectScripts(page);
//     } else {
//         spinner.info("You are not logged in. Please scan the QR below");
//     }
//     return output;
// }

//TODO: add logic to refresh QR.
// async function getAndShowQR() {
//     //TODO: avoid using delay and make it in a way that it would react to the event. 
//     //await utils.delay(10000);
//     var scanme = "img[alt='Scan me!'], canvas";
//     await page.waitForSelector(scanme);
//     var imageData = await page.evaluate(`document.querySelector("${scanme}").parentElement.getAttribute("data-ref")`);
//     //console.log(imageData);
//     qrcode.generate(imageData, { small: true });
//     spinner.start("Waiting for scan \nKeep in mind that it will expire after few seconds");
//     var isLoggedIn = await injectScripts(page);
//     while (!isLoggedIn) {
//         //console.log("page is loading");
//         //TODO: avoid using delay and make it in a way that it would react to the event. 
//         await utils.delay(300);

//         isLoggedIn = await injectScripts(page);
//     }
//     if (isLoggedIn) {
//         spinner.stop("Looks like you are logged in now");
//         //console.log("Welcome, WBOT is up and running");
//     }
// }

// can't implement this function with new version of whatsapp web
// async function setupSmartReply() {
//     spinner.start("setting up smart reply");
//     await page.waitForSelector("#app");
//     await page.evaluate(`
//             var observer = new MutationObserver((mutations) => {
//                 for (var mutation of mutations) {
//                     //console.log(mutation);
//                     if (mutation.addedNodes.length && mutation.addedNodes[0].id === 'main') {
//                         //newChat(mutation.addedNodes[0].querySelector('.copyable-text span').innerText);
//                         console.log("%cChat changed !!", "font-size:x-large");
//                         WAPI.addOptions();
//                     }
//                 }
//             });
//             observer.observe(document.querySelector('#app'), { attributes: false, childList: true, subtree: true });
//         `);
//     spinner.stop("setting up smart reply ... done!");
//     page.waitForSelector("#main", { timeout: 0 }).then(async () => {
//         await page.exposeFunction("sendMessage", async message => {
//             return new Promise(async (resolve, reject) => {
//                 // Type message with space to the currently open chat using power of puppeteer 
//                 await page.type("#main div.selectable-text[data-tab]", message + " ");
//                 if (configs.smartreply.clicktosend) {
//                     page.keyboard.press("Enter");
//                 }
//             });
//         });
//     });
// }

// async function setupPopup() {
//     spinner.start("Setting up the popup");
//     await page.waitForSelector("#app");
//     await page.evaluate(`
//             var observer = new MutationObserver((mutations) => {
//                 for (var mutation of mutations) {
//                     //console.log(mutation);
//                     if (mutation.addedNodes.length && mutation.addedNodes[0].id === 'main') {
//                         //newChat(mutation.addedNodes[0].querySelector('.copyable-text span').innerText);
//                         console.log("%cChat changed !!", "font-size:x-large");
//                         WAPI.setupFeaturePage();
//                     }
//                 }
//             });
//             observer.observe(document.querySelector('#app'), { attributes: false, childList: true, subtree: true });
//         `);
//     spinner.stop("Setting up the popup... Completed");
// }

async function checkForUpdate() {
    spinner.start("Checking for an Update...");
    // Using Github API (https://docs.github.com/en/rest/reference/repos#releases)
    // to get the releases data
    const url = "https://api.github.com/repos/vasani-arpit/WBOT/releases";
    const response = await fetch(url);

    // Storing data in form of JSON
    var data = await response.json();
    var latestVersion = data[0].tag_name;
    var latestVersionLink = `https://github.com/vasani-arpit/WBOT/releases/tag/${latestVersion}`;
    var myVersion = 'v' + require('../package.json').version;

    spinner.stop("Checking for an Update... Completed");

    if (lt(myVersion, latestVersion)) {
        console.log(`An Update is available for you.\nPlease download the latest version ${latestVersion} of WBOT from ${latestVersionLink}`);
    }
}

Main();
