/**
 * Copyright (c) 2014 Baidu.com, Inc. All Rights Reserved
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * @file src/vod_client.js
 * @author zhouhua
 */

/* eslint-env node */
/* eslint max-params:[0,10] */
/* eslint-disable fecs-camelcase */

var util = require('util');
var u = require('underscore');
var Q = require('q');

var BceBaseClient = require('./bce_base_client');
var BosClient = require('./bos_client');
var H = require('./headers');
var helper = require('./helper');

/**
 * VOD音视频点播服务
 *
 * @see https://bce.baidu.com/doc/VOD/API.html#API.E6.8E.A5.E5.8F.A3
 * @constructor
 * @param {Object} config The VodClient configuration.
 * @extends {BceBaseClient}
 */
function VodClient(config) {
    // Vod is a global service. It doesn't support region.
    BceBaseClient.call(this, config, 'vod', false);

    var bosConfig = this.config.bos || {};
    if (!bosConfig.credentials) {
        bosConfig.credentials = this.config.credentials;
    }
    if (!bosConfig.sessionToken) {
        bosConfig.sessionToken = this.config.sessionToken;
    }

    this._bosClient = new BosClient(bosConfig);

    var client = this;
    this._bosClient.on('progress', function (evt) {
        client.emit('progress', evt);
    });
}
util.inherits(VodClient, BceBaseClient);

// --- BEGIN ---

VodClient.prototype.createMediaResource = function (title, description, blob, options) {
    options = options || {};

    var mediaId;
    var client = this;
    var bosClient = this._bosClient;
    return client._generateMediaId(blob, options)
        .then(function (res) {
            mediaId = res.body.mediaId;
            return helper.upload(bosClient, 'vod', mediaId, res.body.sourceBucket, res.body.sourceKey, blob, options);
        })
        .then(function () {
            return helper.afterUpload(blob, 'vod');
        })
        .then(function () {
            return client._internalCreateMediaResource(mediaId, title, description, options);
        });
};

VodClient.prototype.getMediaResource = function (mediaId, options) {
    return this.buildRequest('GET', mediaId, null, options);
};

VodClient.prototype.listMediaResource = function (options) {
    return this.buildRequest('GET', null, null, options);
};

VodClient.prototype.updateMediaResource = function (mediaId, title, description, options) {
    options = options || {};
    return this.buildRequest('PUT', mediaId, 'attributes', u.extend(options, {
        body: JSON.stringify({
            title: title,
            description: description
        })
    }));
};

VodClient.prototype.stopMediaResource = function (mediaId, options) {
    return this.buildRequest('PUT', mediaId, 'disable', options);
};

VodClient.prototype.publishMediaResource = function (mediaId, options) {
    return this.buildRequest('PUT', mediaId, 'publish', options);
};

VodClient.prototype.deleteMediaResource = function (mediaId, options) {
    return this.buildRequest('DELETE', mediaId, null, options);
};

VodClient.prototype.rerunMediaResource = function (mediaId, options) {
    return this.buildRequest('PUT', mediaId, 'rerun', options);
};

VodClient.prototype.getPlayableUrl = function (mediaId, options) {
    options = options || {};
    return this._buildRequest('GET', '/v1/service/file', null, null, u.extend(options, {
        params: {
            media_id: mediaId
        }
    }));
};

VodClient.prototype.getPlayerCode = function (mediaId, width, height, autoStart, options) {
    options = options || {};
    return this._buildRequest('GET', '/v1/service/code', null, null, u.extend(options, {
        params: {
            media_id: mediaId,
            ak: this.config.credentials.ak,
            width: width,
            height: height,
            auto_start: autoStart
        }
    }));
};

VodClient.prototype._generateMediaId = function (file, options) {
    var state = helper.beforeUpload(file, 'vod');
    if (state) {
        return Q.resolve({
            body: {
                mediaId: state.id,
                sourceBucket: state.bucket,
                sourceKey: state.object
            }
        });
    }
    return this.buildRequest('GET', 'internal', null, options);
};

VodClient.prototype._internalCreateMediaResource = function (mediaId, title, description, options) {
    var params = {title: title};
    if (description) {
        params.description = description;
    }
    options = options || {};
    return this.buildRequest('POST', 'internal/' + mediaId, null, u.extend(options, {
        body: JSON.stringify(params)
    }));
};

VodClient.prototype.buildRequest = function (verb, mediaId, query, options) {
    return this._buildRequest(verb, '/v1/media', mediaId, query, options);
};

VodClient.prototype._buildRequest = function (verb, url, mediaId, query, options) {
    var defaultArgs = {
        body: null,
        headers: {},
        params: {},
        config: {}
    };
    options = u.extend(defaultArgs, options);
    if (mediaId) {
        url += '/' + mediaId;
    }
    if (query) {
        options.params[query] = '';
    }
    if (!options.headers.hasOwnProperty(H.CONTENT_TYPE)) {
        options.headers[H.CONTENT_TYPE] = 'application/json';
    }
    if (!options.headers.hasOwnProperty(H.ACCEPT_ENCODING)) {
        options.headers[H.ACCEPT_ENCODING] = 'gzip, deflate';
    }
    if (!options.headers.hasOwnProperty(H.ACCEPT)) {
        options.headers[H.ACCEPT] = '*/*';
    }
    return this.sendRequest(verb, url, options);
};

// --- E N D ---

module.exports = VodClient;

/* vim: set ts=4 sw=4 sts=4 tw=120: */
