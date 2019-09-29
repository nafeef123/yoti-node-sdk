const superagent = require('superagent');
const { YotiResponse } = require('./response');
const yotiCommon = require('../yoti_common');

/**
 * Default HTTP request handler.
 *
 * @param {YotiRequest} yotiRequest
 * @param {boolean} buffer Return the response as a Buffer.
 *
 * @returns {Promise} Resolves {YotiResponse}
 */
module.exports.execute = (yotiRequest, buffer = false) => new Promise((resolve, reject) => {
  const request = superagent(yotiRequest.getMethod(), yotiRequest.getUrl());

  if (yotiCommon.requestCanSendPayload(yotiRequest.getMethod())) {
    request.send(yotiRequest.getPayload().getPayloadJSON());
  }

  if (buffer === true) {
    request.buffer(buffer);
  }

  if (yotiRequest.getHeaders()) {
    request.set(yotiRequest.getHeaders());
  }

  request
    .then((response) => {
      let parsedResponse = null;
      let receipt = null;

      if (response.body instanceof Buffer) {
        parsedResponse = response.body;
      } else if (response.text) {
        parsedResponse = response.headers['content-type'] ? response.body : JSON.parse(response.text);
        receipt = parsedResponse.receipt || null;
      }

      try {
        return resolve(new YotiResponse(
          parsedResponse,
          response.statusCode,
          receipt
        ));
      } catch (err) {
        return reject(err);
      }
    })
    .catch((err) => {
      console.log(`Error getting data from Connect API: ${err.message}`);
      return reject(err);
    });
});
