'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

class Controller {
  static sendResponse(response, payload) {
    response.status(payload.code || 200);

    const responsePayload =
      payload && payload.payload !== undefined ? payload.payload : payload;

    if (responsePayload instanceof Object) {
      response.json(responsePayload);
    } else {
      response.end(responsePayload);
    }
  }

  static sendError(response, error) {
    response.status(error.status || error.code || 500);

    if (error.error instanceof Object) {
      response.json(error.error);
    } else {
      response.json({
        error: error.message || 'Error interno del servidor',
        salida: error.salida || 'Se ha producido un error'
      });
    }
  }

  static collectFile(request, fieldName) {
    let uploadedFileName = '';

    if (request.files && request.files.length > 0) {
      const fileObject = request.files.find((file) => file.fieldname === fieldName);

      if (fileObject) {
        const fileArray = fileObject.originalname.split('.');
        const extension = fileArray.pop();
        fileArray.push(`_${Date.now()}`);
        uploadedFileName = `${fileArray.join('')}.${extension}`;

        fs.renameSync(
          path.join(config.FILE_UPLOAD_PATH, fileObject.filename),
          path.join(config.FILE_UPLOAD_PATH, uploadedFileName)
        );
      }
    }

    return uploadedFileName;
  }

  static collectRequestParams(request) {
    const requestParams = {};
    const openapiSchema = request.openapi?.schema;
    const requestBody = openapiSchema?.requestBody;
    const parameters = openapiSchema?.parameters || [];

    if (requestBody && requestBody.content) {
      const { content } = requestBody;

      if (content['application/json'] !== undefined) {
        requestParams.body = request.body;
      } else if (content['multipart/form-data'] !== undefined) {
        const formSchema = content['multipart/form-data'].schema;

        if (formSchema && formSchema.properties) {
          Object.keys(formSchema.properties).forEach((property) => {
            const propertyObject = formSchema.properties[property];

            if (
              propertyObject.format !== undefined &&
              propertyObject.format === 'binary'
            ) {
              requestParams[property] = this.collectFile(request, property);
            } else {
              requestParams[property] = request.body[property];
            }
          });
        }
      }
    }

    parameters.forEach((param) => {
      if (param.in === 'path') {
        requestParams[param.name] = request.openapi.pathParams[param.name];
      } else if (param.in === 'query') {
        requestParams[param.name] = request.query[param.name];
      } else if (param.in === 'header') {
        requestParams[param.name] = request.headers[param.name.toLowerCase()];
      }
    });

    return requestParams;
  }

  static async handleRequest(request, response, serviceOperation) {
    try {
      const requestParams = this.collectRequestParams(request);
      const serviceResponse = await serviceOperation(requestParams);
      Controller.sendResponse(response, serviceResponse);
    } catch (error) {
      Controller.sendError(response, error);
    }
  }
}

module.exports = Controller;