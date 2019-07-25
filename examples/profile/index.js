require('dotenv').config();
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const Yoti = require('yoti');

const app = express();
const port = process.env.PORT || 9443;

// The scenario ID and .pem file are generated by https://www.yoti.com/dashboard when you create your app
// The client SDK ID is generated by https://www.yoti.com/dashboard when you publish your app
const config = {
  SCENARIO_ID: process.env.YOTI_SCENARIO_ID, // Your Yoti Scenario ID
  CLIENT_SDK_ID: process.env.YOTI_CLIENT_SDK_ID, // Your Yoti Client SDK ID
  PEM_KEY: fs.readFileSync(process.env.YOTI_KEY_FILE_PATH), // The content of your Yoti .pem key
};

function saveImage(selfie) {
  return new Promise((res, rej) => {
    try {
      fs.writeFileSync(
        path.join(__dirname, 'static', 'YotiSelfie.jpeg'),
        selfie.toBase64(),
        'base64',
      );
      res();
    } catch (error) {
      rej(error);
    }
  });
}

const yotiClient = new Yoti.Client(config.CLIENT_SDK_ID, config.PEM_KEY);

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/static', express.static('static'));

const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/index', {
    yotiClientSdkId: config.CLIENT_SDK_ID,
    yotiScenarioId: config.SCENARIO_ID,
  });
});

router.get('/dynamic-share', (req, res) => {
  const locationExtension = new Yoti.LocationConstraintExtensionBuilder()
    .withLatitude(51.5074)
    .withLongitude(-0.1278)
    .withRadius(6000)
    .build();

  const givenNamesWantedAttribute = new Yoti.WantedAttributeBuilder()
    .withName('given_names')
    .build();

  const dynamicPolicy = new Yoti.DynamicPolicyBuilder()
    .withWantedAttribute(givenNamesWantedAttribute)
    .withWantedAttributeByName('email_address')
    .withFullName()
    .withSelfie()
    .withPhoneNumber()
    .withAgeOver(18)
    .build();

  const dynamicScenario = new Yoti.DynamicScenarioBuilder()
    .withCallbackEndpoint('/profile')
    .withPolicy(dynamicPolicy)
    .withExtension(locationExtension)
    .build();

  yotiClient.createShareUrl(dynamicScenario)
    .then((shareUrlResult) => {
      res.render('pages/dynamic-share', {
        yotiClientSdkId: config.CLIENT_SDK_ID,
        yotiShareUrl: shareUrlResult.getShareUrl(),
      });
    }).catch((error) => {
      console.error(error.message);
    });
});

router.get('/profile', (req, res) => {
  const { token } = req.query;
  if (!token) {
    res.render('pages/error', {
      error: 'No token has been provided.',
    });
    return;
  }

  const promise = yotiClient.getActivityDetails(token);
  promise.then((activityDetails) => {
    const userProfile = activityDetails.getUserProfile();
    const profile = activityDetails.getProfile();
    const { selfie } = userProfile;

    if (typeof selfie !== 'undefined') {
      saveImage(selfie);
    }

    res.render('pages/profile', {
      rememberMeId: activityDetails.getRememberMeId(),
      parentRememberMeId: activityDetails.getParentRememberMeId(),
      selfieUri: activityDetails.getBase64SelfieUri(),
      userProfile,
      profile,
    });
  }).catch((err) => {
    console.error(err);
    res.render('pages/error', {
      error: err,
    });
  });
});

app.use('/', router);

// START THE SERVER
// =============================================================================
https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'keys', 'server-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'keys', 'server-cert.pem')),
}, app).listen(port);

console.log(`Server running on https://localhost:${port}`);
