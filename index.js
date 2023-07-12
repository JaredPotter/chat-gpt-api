/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const puppeteer = require("puppeteer");
// const chromium = require('chrome-aws-lambda');

const puppeteerTimeout = 60000;


// exports.helloWorld = onRequest({memory: '1GiB', timeoutSeconds: 60}, async (request, response) => { // v2
exports.helloWorld = functions.runWith({ memory: '1GB', timeoutSeconds: 90 }).https.onRequest(async (request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  logger.info('process.platform: ' + process.platform, {structuredData: true});

  const message = await openChatGpt();

  logger.info('message: ' + message);

  response.send({ 
    message
  });
});

async function openChatGpt() {
    // const headless = process.argv[2] === 'isDev' ? false : 'new';
    // const headless = false;

    const conf = {
        vpnUser: '',
        vpnPass: '',
        vpnServier: ''
    }; 

    const headless = true;
    const browser = await puppeteer.launch(
        { 
            headless,
            // args: chromium.args,
            // defaultViewport: chromium.defaultViewport,
            // executablePath: await chromium.executablePath,
            timeout: 20000,
            ignoreHTTPSErrors: true,
            slowMo: 0,
            args: [
              '--disable-gpu',
              '--disable-dev-shm-usage',
              '--disable-setuid-sandbox',
              '--no-first-run',
              '--no-sandbox',
              '--no-zygote',
              '--window-size=1280,720',
            ],
        });
    const page = await browser.newPage();    
    await page.goto('https://chat.openai.com/');

    const cookie1 = {
        name:'intercom-device-id-dgkjq2bp',
        value: 'dae69cd9-d07d-4dd5-8ca2-3797cd2e3d06',
        url: 'https://chat.openai.com/'
    };
    const cookie2 = {
        name:'__Host-next-auth.csrf-token',
        value: '75e5b2dcb03f57415627d5d5c9624dc0a299126e43cfb4d13cf4dfc58dd611be%7C38200abb9a8e5d21a23c21deecad1e17e90b05de0cebf6922e18ecd7302eba54',
        url: 'https://chat.openai.com/'
    };
    const cookie3 = {
        name:'__Secure-next-auth.callback-url',
        value: 'https%3A%2F%2Fchat.openai.com',
        url: 'https://chat.openai.com/'
    };
    const cookie4 = {
        name:'intercom-session-dgkjq2bp',
        value: 'UndjVzdOMUZJYURmbEF3VUh6SUZ3SmxNSEtsNWhEZ04vVzdkMTNQUFo1Vk94SlZseFpnVWh0S0lrVWFzUmJINC0tMy80eTdQemtZbzlqRjI0c2l5M0xIZz09--bc4a20d5fb57a7a73b06b8be1ede314cdab43283',
        url: 'https://chat.openai.com/'
    };
    const cookie5 = {
        name:'__Secure-next-auth.session-token',
        value: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..x2_-iBKr353aJcDp.e2-_qm_TUO-8-ppQwDJh-OOXc4ZRejvxzr43YT_0bImBiwc7BWYXSoKCNxL5b4oQzcIzHzwFxdnEHaJZLWSfCfCjJaCRLiAQthfgkwKNfQzzSIVZR6Xis-P-onu92-CTJOtrJo9jc4jrPDJJ29rgAXxAcwzs9ztcu1jiFAA790Hgb9Tlt2PWd0cxUWPVzFLAzgdNtmI-UrFNFwf0rAeueik3NkzpKP0jGc7sN4Cs67jFpGYT62XMvJifIplinTiIgRrpTSIOE5GrCa-NLpLiMiQO1okCgfNCA3vKiBTvrqzDYggui8GP3crcSVlMG3X-OKGrCB8LyU7VmoHyf8T8PH0MJbLjVlRxTgNzUdqXKt-Xkdayu2UfnFv_Wb9L2TAnWPceag6AVS8jcNwjLU1XOPocZNjdyrF9F0AisApy6MZx3qyWTHDwEir7vIk_PLfj2uRJ5DUaKR3aNNPrAmd4TmBR2aCxlNqIGxNt_LGjrcpj29dnCiXkUauw03K0S4RHuuvYwODtS8UlcUU8lBVn0loKmawk2DmooUCZw2LdigsRFCpvkClNOjQY-vxkW6keSbsvckCYiYsphnuaQNa2ucfYFIsQzX3yKG73Jyu2Ot6ZrcA2NA4to_Vu6IluYh-KAuCofPbNlE6LHyDRc6WlFXX8SIJbfTIJ95G7mQeqyLOQ11JDmkfNzN8BW-s7VPNhzFBAYUyFnURilMFzP9Q5EikYPOp-Jwjaj-9PfNgemA4_2z6v3lpgJhbCd0fyl2REjF5i3zofXHULuYk3hxy4pypmBw9OEn7PK-9NXnrsoxGsq5nV0_PzmoDTQF8qkoZu9m3TSS9rg-N9JYubz0XfL_C2AgaqDYDVdoesZG6wLXs7RT_8szy45PSksCuJkenrX8w_4zDv7nrxphrOU8Gtbz15Dzac4Z3Wf_NxPwQc30nIqF8wF8kiXuB4rypBuXmhfyXgr2B2LtoUYNmXlbK_qDezuIl6jJMBMn27e7FLrSyi_cQr59lqGZltFNZpjqJ7s6w32PzV3xh4w5YeGGguU0SIN7EzkujtbhLAv3pLKWcCndqee4H1T58y5Tcfn_z_oCWdL8Ak0ACzRg31mGYkiwobI1OuitTw84zmbGVFrcFmf8qZNldS8vzyJ2IlqjaIt7XgqUQwCSz-QHq2h4RUkdMYL1PbdI9JheKo7zsAIkIlxSUnAEB9-UHo_rS-zQCnGu_pYu5mrTNL5pdwHDxx_ODji2sPp2-si11v1A8rLu60CwN21PzE_AXNrnZLTPTFbnsYL2fgKhNuzbNdDWIwhIG2OMKpQ9E7R9AHMLI0wPiKBJauf7WSy-NQKpI-PDDPGKpKzeR12uFMoPqYarVO8SRh2s41Hyc1F6_UESvq2Y7F-8_tyMVuCe0T_8CNHqCKU15dTqZxg5DXUBlW6BUTdk-jHSJwKkXBaCB3E1XHp_uZpJBsF9vCv4XNu_HBbq4PRyeOV6f5acEWH_Hfy3dOeQAr8euWlWl9OtpsYbsdK_mSp64cGflJ9IUIJOL7LD4C4pucV5Um5VKu9vKeoPY7GIc2U1fMUzdlLkUxGA2v-XJmQDqY6SC9MkntoOC4Jj930kS-4P5PhMBHMr0SfiJYAeJJBH6utKmhFpHzLT0nkUwe92Qezok6LLUf0ZSiTXkJkFMfXMqyCsBWQJsHMunBmv4Z2dYZ6sHz4uURnIQRXVnJVcUilIgUC7i3e6Zd5-JBt9SHOHX_dc_YnKrak0JUehkFQiylxgB3jEa4AFCQuK7RIBwbOsLC-Yw_H7pkRRKNPL8XeDbw8zpcl8h_OskCgi_FtBwacz7QL5x61NcRLiLVdJho1vflevko887h1YQzpo35_w9ns6R14U14J59s9WAy7OlhFhHrTdy85dNy2LQaOmjtYscS2xYfoZUl733V1SxSwCDtXvoFu2FfGxePU--KlSOW8Grofa8tm1MaZL-RBu744OHm_mKRIQsA0CWGKNxfEMU-C9lsHUP9gUT0aaA2VLWXGzRW41bt-RPObvQbL_TFxi9KIh8NCcLgNuhCmbOZ0QjBaj3o9yxOmhIb-3qnkBY0HtEqaArOgK6v_mjJRH6gIynBikksMY0GAxcU_o90SZmdHnkcSP9-f1AqSp-NCLc5vm15iyYTqObk0ePXmjJaqOwsFFhji549_BqvLROWh84_axKmjSYw7J_0Mm6hHhGZURhdzdbWcFpith6HJQ9BuebY6YwWPkQ6fiAMX_PugNr44buYr1L4wG94tDVo4035HxuS17bTCvkhlbwlfI6YOs1eV6vaYaiP7tiHCpyQoTo_DdAqwZlkQdhT2bcGhObIeLgY_1GLN1IMXhtUl2pZKfnxrccyIdE78jr4M16mRzc1HqzOezpnD2XuJUCi6gTp8yRV_MHpzA6hu-LXDJ9PE1YraovqDMhg798DF_N1XzSUPp5XDycJwQnS949ZGGbb5pUJnvuDmIc4XtQARlp9mVo25TAShbj_Xf5sKXRQIhGz0Y--gWTcdWLuHHE7DNBdiUSTmFZo82dS6_PZt6EKE-MF9TGHHxA6GNK7a6Y5aiPk4RUCLhl75bkFiX8dCzVgU8RBFmC5hiNi-sSvGGgHM6v7PAbhj0nsI5gHKIS1u8zppCCc9ncmX-LvudVzQSOB2eVcyHZHbwWq5_3uTUhq_PFbPXXDzx0UFaNXRSTPIuanwbg1.wGP3GKiRkvYY5m7FGLtO_A',
        url: 'https://chat.openai.com/'
    };
    const cookie6 = {
        name:'__cf_bm',
        value: 'unTBdaeoiu2VmLC13HFb3R_D1JQywkrWsPOcAhHiJTA-1689003053-0-AUKh/xwFCYiBV6oDw03mFFlzzAbx7w2fThVgAirQ+HEHly+7EhzrsLgXNh+scQGCQK1VYp/TGtYhumxSQvNnRn5wTW4wuwGN6kYf8O4sIGca',
        url: 'https://chat.openai.com/'
    };
    const cookie7 = {
        name:'_cfuvid',
        value: 'WTyP7m4MoRE79lA8z7ptBdqCXGPrdbR95k8qmLTj1Ic-1689003053227-0-604800000',
        url: 'https://chat.openai.com/'
    };
    const cookie8 = {
        name:'_dd_s',
        value: 'rum=0&expire=1689004636223',
        url: 'https://chat.openai.com/'
    };
        
    try {
        await page.setCookie(cookie1, cookie2, cookie3, cookie4, cookie5, cookie6, cookie7, cookie8);
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.goto('https://chat.openai.com/');
        const initialCookies = await page.cookies();
        // console.log('initialCookies: ' + JSON.stringify(initialCookies, null, 4));
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCache');
        await page.reload({ waitUntil: "networkidle0" });     
        const refreshedCookies = await page.cookies();
        // console.log('refreshedCookies: ' + JSON.stringify(refreshedCookies, null, 4));
    } catch (error) {
        debugger;
    }

    const randomFahrenheitNumber = Math.floor(Math.random() * 213); // between 0 and 212
    const requestMessage = `What is ${randomFahrenheitNumber}F converted to C? Only print the exact number followed by a C character and nothing else.`;
    const responseMessage = await queryChatGpt(page, requestMessage);

    // await browser.close();
    return responseMessage;
}

async function queryChatGpt(page, message) {
    const messageTextboxElement = await page.waitForSelector('[data-id="root"]', { timeout: puppeteerTimeout });
    await messageTextboxElement.type(message);
    await page.keyboard.press('Enter');
    const buttonXPath = '//button[@as="button"]//div[contains(text(), "Regenerate response")]';
    await page.waitForXPath(buttonXPath, { timeout: puppeteerTimeout});
    // const responseMessage = await page.waitForXPath(responseMessageXPath);
    const responseMessage = await page.evaluate(() => {
        const responseMessageSelector = '#__next > div.overflow-hidden.w-full.h-full.relative.flex.z-0 > div > div > main > div.flex-1.overflow-hidden > div > div > div > div > div > div.gap-1';
        const messages = document.querySelectorAll(responseMessageSelector);
        const mostRecentMessageNode = messages[messages.length - 1];
        // console.log(mostRecentMessageNode);
        // console.log(JSON.stringify(mostRecentMessageNode, null, 4));
        const mostRecentMessage = mostRecentMessageNode.textContent;
        // const responseMessageXPath = '//*[@id="__next"]/div[1]/div[2]/div/main/div[2]/div/div/div/div[last()]';
        // const message = document.querySelector(responseMessageXPath).textContent();
        // const result = document.evaluate(responseMessageXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        // const message = result.singleNodeValue.textContent();

        return mostRecentMessage;
    });

    return responseMessage;
}

(async () => {
    if(process.argv[2] === 'isDev') {
        const message = await openChatGpt();
        console.log(message);
    }
})()
