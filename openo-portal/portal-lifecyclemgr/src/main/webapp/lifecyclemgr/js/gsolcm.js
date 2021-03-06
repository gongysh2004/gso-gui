/*
 * Copyright 2016 ZTE Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var templateParameters = {
    changed: true,
    parameters: [],
    vimInfos: []
};

var lcmHandler = function () {
    this._addOwnEvents();
    jQuery.i18n.properties({
        language:'en-US',
        name:'lcm-template-parameters-i18n',
        path:'i18n/',
        mode:'map'
    });
};

lcmHandler.prototype = {
    _addOwnEvents: function () {
        $('#createNS').click(this.okAction);
    },
    okAction: function () {
    	if(!checkLocation(templateParameters.parameters)) {
    		alert('Location must be selected in Template Parameters');
    		return;
    	}
        $.isLoading({ text: "Creating service..." });
        var serviceInstance = {
            serviceTemplateId: $("#svcTempl").val(),
            serviceName: $('#svcName').val(),
            description: $('#svcDesc').val(),
            inputParameters: collectServiceParameters(templateParameters.parameters)
        };
        var gatewayService = '/openoapi/servicegateway/v1/services';
        $.when(
            fetchServiceTemplateBy(serviceInstance.serviceTemplateId)
        ).then(
            function(template) {
                serviceInstance.templateName = template.name;
                serviceInstance.serviceType = template.serviceType;
                return createNetworkServiceInstance(template, serviceInstance, gatewayService);
            }
        ).then(
            function(response) {
                $.isLoading('hide');
                if(response.status === 'success') {
                    updateTable(response.instance);
                    $('#vmAppDialog').removeClass('in').css('display', 'none');
                } else {
                    showErrorMessage('Create service failed', response.errorResult);
                }
            }
        );
    }
};

function showErrorMessage(title, result) {
    var info = '<br/>' + '<h5>' + title + '</h5><hr/>';
    info = info + '<h6>Status: ' + result.status + '</h6><p/>';
    info = info + '<h6>Description: </h6>';
    if(result.statusDescription.forEach === undefined) {
        info = info + '<h6>' + result.statusDescription + '</h6><p/>';
    } else {
        result.statusDescription.forEach(function(message) {
            info = info + '<h6>' + message + '</h6><p/>';
        });    
    }
    info = info + '<h6>Error code: '+ result.errorCode + '</h6>';
    $.bootstrapGrowl(info, {
        type: 'danger',
        align: 'center',
        width: "auto",
        delay: 10000,
        allow_dismiss: true
    });
}

function checkLocation(parameters) {
	var checkPass = true;
	var i = 0;
	for(i = 0; i < parameters.length; i++) {
		if(parameters[i].type === 'location') {
			var value = $('#' + parameters[i].id).val();
			if(value === undefined || value === 'select') {
				checkPass = false;
			}
		}
	}
	return checkPass;
}

function initParameterTab() {
	// Service template was not changed. Do not re-initiate the parameter tab.
    if (!templateParameters.changed) {
        return;
    }
    var templateId = $("#svcTempl").val();
    if ('select' === templateId) {
        document.getElementById("templateParameterTab").innerHTML = '';
        return;
    }
	$.when(
		fetchServiceTemplateBy(templateId)
	).then(
	    function(template) {
	    	if(template.serviceType === 'GSO') {
	    		return fetchGsoTemplateInputParameters(templateId, template);
	    	} else if(template.serviceType === 'NFVO') {
	    		return fetchNfvoTemplateInputParameters(templateId, template);
	    	} else if(template.serviceType === 'SDNO') {
	    		return fetchSdnoTemplateInputParameters(templateId, template);
	    	}
	    }
	).then(
	    function(parameters) {
	    	var components = transformToComponents(parameters);
	    	document.getElementById("templateParameterTab").innerHTML = components;
	    }
	);
}

function fetchServiceTemplateBy(templateId) {
    var defer = $.Deferred();
    var serviceTemplateUri = '/openoapi/catalog/v1/servicetemplates/' + templateId;
    var template = {};
    $.when(
        $.ajax({
            type: "GET",
            url: serviceTemplateUri,
            contentType: "application/json"
        })
    ).then(
        function(response) {
            template.name = response.templateName;
            template.gsarId = response.csarId;
            template.id = response.id;
            template.nodeType = '';
            return fetchCsar(template.gsarId);
        }
    ).then(
        function(response) {
            if(response.type === 'GSAR') {
                template.serviceType = 'GSO';
            } else if(response.type === 'NSAR' || response.type === 'NFAR') {
                template.serviceType = 'NFVO';
            } else if(response.type === 'SSAR') {
                template.serviceType = "SDNO";
            }
            defer.resolve(template)
        }
    );
    return defer;
}

function fetchCsar(csarId) {
	var queryCsarUri = '/openoapi/catalog/v1/csars/' + csarId;
	return $.ajax({
		type: "GET",
		url: queryCsarUri,
		contentType: "application/json"
	});
}

function fetchGsoTemplateInputParameters(templateId, template) {
	var defer = $.Deferred();
    $.when(
        fetchTemplateParameterDefinitions(templateId),
        fetchGsoNestingTemplateParameters(templateId),
        fetchVimInfo(),
        fetchSdnController()
    ).then(
        function (templateParameterResponse, nestingTempatesParas, vimInfoResponse, sdnControllersResponse) {
            var inputs = templateParameterResponse[0].inputs.map(function(input) {
                input.showName = input.name;
                if(template.nodeType === null || template.nodeType === undefined || template.nodeType.length === 0) {
                    input.i18nKey = input.name;    
                } else {
                    input.i18nKey = template.nodeType + '.' +input.name;    
                }
                return input;
            });
        	var inputParas = concat(inputs, nestingTempatesParas);
        	var vims = translateToVimInfo(vimInfoResponse[0]);
            var sdnControllers = translateToSdnControllers(sdnControllersResponse[0]);
            templateParameters = translateToTemplateParameters(inputParas, vims, sdnControllers);
            defer.resolve(templateParameters);
        }
    );
    return defer;
}

function fetchGsoNestingTemplateParameters(templateId) {
	var defer = $.Deferred();
	$.when(
		fetchNodeTemplates(templateId)
	).then(
	    function(nodeTemplates) {
	    	var count = nodeTemplates.length;
	    	if(count ===0) {
	    		defer.resolve([]);
	    		return;
	    	}
	    	var nestingParasAggregatation = aggregate(count, function(nestingParas) {
	    		defer.resolve(nestingParas);
	    	});
	    	nodeTemplates.forEach(function(nodeTemplate) {
	    		var nestingNodeUri = '/openoapi/catalog/v1/servicetemplates/nesting?nodeTypeIds=' + nodeTemplate.type;
	    		$.when(
	    			$.ajax({
	    				type: "GET",
	    				url: nestingNodeUri
	    			})
	    		).then(
	    		    function(serviceTemplates) {
	    		    	var nodeAggregatation = aggregate(serviceTemplates.length, function(oneNodeParameters) {
	    		    		nestingParasAggregatation.notify(oneNodeParameters);
	    		    	});
	    		    	serviceTemplates.forEach(function(serviceTemplate) {
                            if(serviceTemplate === null || serviceTemplate === undefined || serviceTemplate.inputs === undefined || serviceTemplate.csarId === undefined)
                            {
                                nodeAggregatation.notify([]);
                                return;
                            }
	    		    		var inputs = serviceTemplate.inputs.map(function(input) {
                                input.showName = input.name;
	    		    			input.name = nodeTemplate.type + '.' + input.name;
                                input.i18nKey = nodeTemplate.type + '.' + input.name;
	    		    			return input;
	    		    		});
	    		    		$.when(
	    		    			fetchCsar(serviceTemplate.csarId)
	    		    		).then(
	    		    		    function(response) {
	    		    		    	if(response.type === 'NSAR' || response.type === 'NFAR') {
	    		    		    		inputs.push({
	    		    		    			name: nodeTemplate.type + '.location',
	    		    		    			type: 'location',
	    		    		    			description: nodeTemplate.name + ' Location',
	    		    		    			required: 'true',
                                            showName: nodeTemplate.name + ' Location',
                                            i18nKey: nodeTemplate.name + ' Location'
	    		    		    		});
                                        inputs.push({
                                            name: nodeTemplate.type + '.sdncontroller',
                                            type: 'sdncontroller',
                                            description: nodeTemplate.name + ' SDN Controller',
                                            required: 'true',
                                            showName: nodeTemplate.name + ' SDN Controller',
                                            i18nKey: nodeTemplate.name + ' SDN Controller'
                                        });
                                    }
	    		    		    	nodeAggregatation.notify(inputs);
	    		    		    }
	    		    		);
	    		    	});
	    		    }
	    		);
	    	});
	    }
	);
	return defer;
}

function fetchNodeTemplates(templateId) {
	var nodeTemplateUri = '/openoapi/catalog/v1/servicetemplates/'+ templateId +'/nodetemplates';
	return $.ajax({
		type: "GET",
		url: nodeTemplateUri
	});
}

function aggregate(n, deferFun) {
	var aggregation = $.Deferred();
	var count = n;
	var result = [];
	aggregation.progress(function(array) {
		pushAll(result, array);
		count--;
		if(count === 0) {
			deferFun(result);
		}
	});
	return aggregation;
}

function concat(array1, array2) {
	var result = [];
	pushAll(result, array1);
	pushAll(result, array2);
	return result;
}

function pushAll(acc, array) {
	var result = acc;
	array.forEach(function(element) {
		result.push(element)
	})
	return result;
}

function translateToTemplateParameters(inputs, vims, controllers) {
    var inputParameters = [];
    var i;
    for (i = 0; i < inputs.length; i += 1) {
        inputParameters[i] = {
            name: inputs[i].name,
            type: inputs[i].type,
            description: inputs[i].description,
            defaultValue: inputs[i].defaultValue,
            required: inputs[i].required,
            id: 'parameters_' + i,
            value: inputs[i].defaultValue || '',
            showName: inputs[i].showName
        };
    }
    return {changed: false, parameters: inputParameters, vimInfos: vims, sdnControllers: controllers};
}

function fetchNfvoTemplateInputParameters(templateId, template) {
	var defer = $.Deferred();
	$.when(
		fetchTemplateParameterDefinitions(templateId),
		fetchVimInfo(),
        fetchSdnController()
	).then(
	    function (templateParameterResponse, vimInfoResponse, sdnControllerResponse) {
	    	var vims = translateToVimInfo(vimInfoResponse[0]);
            var sdnControllers = translateToSdnControllers(sdnControllerResponse[0]);
	    	var inputParas = templateParameterResponse[0].inputs;
            inputParas = inputParas.map(function(input) {
                input.showName = input.name;
                input.i18nKey = template.nodeType + '.' + input.name;
                return input;
            });
	    	inputParas.push({
	    		name: 'location',
	    		type: 'location',
	    		description: 'Location',
	    		required: 'true',
                showName: 'Location',
                i18nKey: 'Location'
	    	});
            inputParas.push({
                name: 'sdncontroller',
                type: 'sdncontroller',
                description: 'SDN Controller',
                required: 'true',
                showName: 'SDN Controller',
                i18nKey: 'SDN Controller'
            });
	    	templateParameters = translateToTemplateParameters(inputParas, vims, sdnControllers);
            defer.resolve(templateParameters);	
	    }
	);
	return defer;
}

function fetchSdnoTemplateInputParameters(templateId, template) {
	var defer = $.Deferred();
	$.when(
		fetchTemplateParameterDefinitions(templateId)
	).then(
	    function (templateParameterResponse) {
            var inputs = templateParameterResponse.inputs.map(function(input) {
                input.showName = input.name;
                input.i18nKey = template.nodeType + '.' + input.name;
                return input;
            })
	    	templateParameters = translateToTemplateParameters(inputs, [], []);
            defer.resolve(templateParameters);	
	    }
	);
	return defer;
}

function fetchTemplateParameterDefinitions(templateId) {
    var queryParametersUri = '/openoapi/catalog/v1/servicetemplates/' + templateId + '/parameters';
    return $.ajax({
        type: "GET",
        url: queryParametersUri
    });
}

function fetchVimInfo() {
    var vimQueryUri = '/openoapi/extsys/v1/vims';
    return $.ajax({
        type: "GET",
        url: vimQueryUri
    });
}

function fetchSdnController() {
    var sdnControllerUri = '/openoapi/extsys/v1/sdncontrollers';
    return $.ajax({
        type: "GET",
        url: sdnControllerUri
    });
}

function translateToVimInfo(vims) {
	return vims.map(function (vim) {
		return {
			optionId: vim.vimId,
			optionName: vim.name
		};
	});
}

function translateToSdnControllers(controllers) {
    return controllers.map(function(controller) {
        return {
            optionId: controller.sdnControllerId,
            optionName: controller.name
        };
    });
}

function transformToComponents(templateParas) {
	var inputs = templateParas.parameters;
	var vimInfos = templateParas.vimInfos;
    var sdnControllers = templateParas.sdnControllers;
	var components = '';
	inputs.forEach(function (inputPara) {
		if(inputPara.type === 'location') {
			components = components + generateComboxComponent(inputPara, vimInfos);
		} else if(inputPara.type === 'sdncontroller') {
            components = components + generateComboxComponent(inputPara, sdnControllers);
        } else {
			components = components + generateComponent(inputPara);
		}
	});
	return components;
}

function generateComboxComponent(inputPara, items) {
    var component = '<div class="form-group" style="margin-left:25px;margin-bottom:15px;">' +
        '<label class="col-sm-3 control-label">' +
        '<span>'+ inputPara.showName +'</span>' +
        '<span class="required">*</span>' +
        '</label>' +
        '<div class="col-sm-7">' +
        '<select class="form-control" style ="padding-top: 0px;padding-bottom: 0px;"' +
        ' id="' + inputPara.id + '" name="'+ inputPara.name +'">' +
        transformToOptions(items) +
        '</select></div></div>';
    return component;
}

function transformToOptions(items) {
    var options = '<option value="select">--select--</option>';
    var i;
    for (i = 0; i < items.length; i += 1) {
        var option = '<option value="' + items[i].optionId + '">' + items[i].optionName + '</option>';
        options = options + option;
    }
    return options;
}

function generateComponent(inputPara) {
	var component = '<div class="mT15 form-group" style="margin-left:25px;">' +
            '<label class="col-sm-3 control-label">' +
            '<span>' + showName(inputPara) + '</span>' + generateRequiredLabel(inputPara) +
            '</label>' +
            '<div class="col-sm-7">' +
            '<input type="text" id="' + inputPara.id + '" name="parameter description" class="form-control" placeholder="' +
            showName(inputPara) + '" value="' + inputPara.value + '" />' +
            '</div></div>';
    return component;
}

function showName(inputPara) {
    var name = $.i18n.prop(inputPara.name)
    if(name.length === 0 || name.slice(0, 1) === '[') {
        name = inputPara.showName;
    }
    return name;
}

function generateRequiredLabel(parameter) {
    var requiredLabel = '';
    if (parameter.required === 'true') {
        requiredLabel = '<span class="required">*</span>';
    }
    return requiredLabel;
}

function createNetworkServiceInstance(template, serviceInstance, gatewayService) {
    if (template.serviceType === 'GSO') {
        return createGsoServiceInstance(gatewayService, serviceInstance, template);
    } else if (template.serviceType === 'NFVO') {
        return createNfvoServiceInstance(gatewayService, serviceInstance, template);
    } else if (template.serviceType === 'SDNO') {
        return createSdnoServiceInstance(gatewayService, serviceInstance);
    }
}

function createGsoServiceInstance(gatewayService, serviceInstance, serviceTemplate) {
    var defer = $.Deferred();
    var gsoLcmUri = '/openoapi/gso/v1/services';
    var parameter = {
    	'service': {
    		'name': serviceInstance.serviceName,
    		'description': serviceInstance.description,
    		'serviceDefId': serviceTemplate.gsarId,
    		'templateId': serviceInstance.serviceTemplateId,
    		'templateName': serviceTemplate.name,
    		'gatewayUri': gsoLcmUri,
    		'parameters': serviceInstance.inputParameters
    	}
    };
    $.when($.ajax({
        type: "POST",
        url: gatewayService,
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(parameter)
    })).then(function(response) {
        if(response.result.status === 'success') {
            serviceInstance.serviceId = response.serviceId;
            var gsoServiceUri = '/openoapi/gso/v1/services/' + response.serviceId;
            var timerDefer = $.Deferred();
            var timeout = 3600000;
            var fun = function() {
                if(timeout === 0) {
                    timerDefer.resolve({
                        status: 'fail', 
                        statusDescription: 'Operation is timeout!', 
                        errorCode: ''
                    });
                    return;
                }
                timeout = timeout - 1000;
                $.when(
                    $.ajax({
                        type: "GET",
                        url: gsoServiceUri
                    })
                ).then(
                    function(response) {
                        if(response.result === 'success' || response.result === 'failed') {
                            timerDefer.resolve(response);
                        }
                    }
                );
            };
            var timerId = setInterval(fun, 1000);
            $.when(timerDefer).then(
                function(responseDesc) {
                    clearInterval(timerId);
                    if(responseDesc.result === 'success') {
                        defer.resolve({status: 'success', instance: serviceInstance});
                    } else {
                        defer.resolve({
                            status: 'fail', 
                            errorResult: {
                                status: responseDesc.result, 
                                statusDescription: 'fail to create the service', 
                                errorCode: ''
                            }});
                    }
                }
             );
        } else {
            defer.resolve({status: 'fail', errorResult: {status:'fail', statusDescription: 'fail to create the service', errorCode: ''}});
        }
    });
    return defer;
}

function createNfvoServiceInstance(gatewayService, serviceInstance, template) {
    var nfvoLcmUri = '/openoapi/nslcm/v1';
    serviceInstance.nsdId = template.id;
    return createServiceInstance(gatewayService, nfvoLcmUri, serviceInstance);
}

function createSdnoServiceInstance(gatewayService, serviceInstance) {
    var sdnoLcmUri = '/openoapi/sdnonslcm/v1';
    serviceInstance.nsdId = serviceInstance.serviceTemplateId;
    return createServiceInstance(gatewayService, sdnoLcmUri, serviceInstance);
}

function createServiceInstance(gatewayService, lcmUri, serviceInstance) {
    var nsUri = lcmUri + '/ns';
    var defer = $.Deferred();
    var sParameter = {
        'nsdId': serviceInstance.nsdId,
        'nsName': serviceInstance.serviceName,
        'description': serviceInstance.description,
        'gatewayUri': nsUri
    };
    $.when($.ajax({
        type: "POST",
        url: gatewayService,
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(sParameter)
    })).then(function(response) {
        if(response.result.status === 'success') {
            var nsInstanceId = response.serviceId;
            serviceInstance.serviceId = nsInstanceId;
            var initNsUrl = nsUri + '/' + nsInstanceId + '/instantiate';
            var parameter = {
                'gatewayUri': initNsUrl,
                'nsInstanceId': nsInstanceId,
                'additionalParamForNs': serviceInstance.inputParameters
            };
            return $.ajax({
                type: "POST",
                url: gatewayService,
                contentType: "application/json",
                dataType: "json",
                data: JSON.stringify(parameter)
            });
        } else {
            return response;
        }
    }).then(function(response) {
        if(response.result.status === 'success') {
            var jobId = response.serviceId;
            var jobStatusUri = lcmUri + '/jobs/' + jobId;
            var timerDefer = $.Deferred();
            var timeout = 3600000;
            var fun = function() {
                if(timeout === 0) {
                    timerDefer.resolve({
                        status: 'fail', 
                        statusDescription: 'Operation is timeout!', 
                        errorCode: ''
                    });
                    return;
                }
                timeout = timeout - 1000;
                $.when(
                    $.ajax({
                        type: "GET",
                        url: jobStatusUri
                    })
                ).then(
                    function(jobResponse) {
                        var responseDesc = jobResponse.responseDescriptor;
                        if(responseDesc.status === 'finished' || responseDesc.status === 'error') {
                            timerDefer.resolve(responseDesc);
                        }
                    }
                );
            };
            var timerId = setInterval(fun, 1000);
            $.when(timerDefer).then(
                function(responseDesc) {
                    clearInterval(timerId);
                    if(responseDesc.status === 'finished') {
                        defer.resolve({status: 'success', instance: serviceInstance});
                    } else {
                        defer.resolve({
                            status: 'fail', 
                            errorResult: {
                                status: responseDesc.status, 
                                statusDescription: responseDesc.statusDescription, 
                                errorCode: responseDesc.errorCode
                            }});
                    }
                }
             );
        } else {
            defer.resolve({status: 'fail', errorResult: response.result});
        }
    });
    return defer;
}


function collectServiceParameters(parameters) {
    var serviceParameters = {};
    var i;
    for (i = 0; i < parameters.length; i += 1) {
    	var value = $('#' + parameters[i].id).val();
        serviceParameters[parameters[i].name] = value;
    }
    return serviceParameters;
}

function updateTable(serviceInstance) {
    serviceInstance.createTime = formatDate(new Date());
    $('#sai').bootstrapTable("append", serviceInstance);
}

function formatDate(date) {
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hh = date.getHours();
    var mm = date.getMinutes();
    var ss = date.getSeconds();
    return year + "-" + month + "-" + day + " " + hh + ":" + mm + ":" + ss;
}

function deleteNe(rowId, row) {
    var deleteHandle = function(result) {
        if(result) {
            $.isLoading({ text: "Deleting service..." });
            var instanceId = row.serviceId;
            var serviceType = row.serviceType;
            var gatewayService = '/openoapi/servicegateway/v1/services/' + instanceId + '/terminate';
            var remove = function () {
                $.isLoading( "hide" );
                $('#sai').bootstrapTable('remove', {field: 'serviceId', values: [instanceId]});
            };
            var failFun = function(responseDesc) {
                $.isLoading( "hide" );
                showErrorMessage("Delete service failed", responseDesc);
            }
            if(serviceType === 'GSO') {
                deleteGsoServiceInstance(gatewayService, instanceId, remove, failFun);
            } else if (serviceType === 'NFVO') {
                var nfvoLcmUri = '/openoapi/nslcm/v1';
                deleteNonGsoServiceInstance(gatewayService, nfvoLcmUri, instanceId, remove, failFun);
            } else if (serviceType === 'SDNO') {
                var sdnoLcmUri = '/openoapi/sdnonslcm/v1';
                deleteNonGsoServiceInstance(gatewayService, sdnoLcmUri, instanceId, remove, failFun);
            }
        }
    };
    bootbox.confirm("Do you confirm to delete service?", deleteHandle);
}

function deleteGsoServiceInstance(gatewayService, instanceId, remove, failFun) {
    var gsoLcmUri = '/openoapi/gso/v1/services';
    $.when(
        deleteNetworkServiceInstance(gatewayService, gsoLcmUri, instanceId)
    ).then(
        function(response) {
            var gsoServiceUri = '/openoapi/gso/v1/services/toposequence/' + instanceId;
            var timerDefer = $.Deferred();
            var timeout = 3600000;
            var fun = function() {
                if(timeout === 0) {
                    timerDefer.resolve({
                        status: 'fail', 
                        statusDescription: 'Operation is timeout!', 
                        errorCode: ''
                    });
                    return;
                }
                timeout = timeout - 1000;
                $.when(
                    $.ajax({
                        type: "GET",
                        url: gsoServiceUri
                    })
                ).then(
                    function(response) {
                        if(response.length == 0) {
                            timerDefer.resolve({status:'success', statusDescription: 'success to delete the service', errorCode: ''});
                        }
                    }
                );
            };
            var timerId = setInterval(fun, 1000);
            $.when(timerDefer).then(
                function(responseDesc) {
                    clearInterval(timerId);
                    remove();
                    if(responseDesc.status != 'success'){
                    	failFun({status: "fail", statusDescription: "delete service failed.", errorCode: "500"});
                    }              
                }
             );           
        }
    );
}

function deleteNonGsoServiceInstance(gatewayService, lcmUri, instanceId, remove, failFun) {
    var nsUri = lcmUri + '/ns';
    $.when(
        terminateNetworkServiceInstance(gatewayService, nsUri, instanceId)
    ).then(
        function(response) {                
            var jobId = response.jobId;
            var jobStatusUri = lcmUri + '/jobs/' + jobId;
            var timerDefer = $.Deferred();
            var timeout = 3600000;
            var fun = function() {
                if(timeout === 0) {
                    timerDefer.resolve({
                        status: 'fail', 
                        statusDescription: 'Operation is timeout!', 
                        errorCode: ''
                    });
                    return;
                }
                timeout = timeout - 1000;
                $.when(
                    $.ajax({
                        type: "GET",
                        url: jobStatusUri
                    })
                ).then(
                    function(jobResponse) {
                        var responseDesc = jobResponse.responseDescriptor;
                        if(responseDesc.status === 'finished' || responseDesc.status === 'error') {
                            timerDefer.resolve(responseDesc);
                        }
                    }
                );
            };
            var timerId = setInterval(fun, 1000);
            $.when(timerDefer).then(
                function(responseDesc) {
                    clearInterval(timerId);
                    if(responseDesc.status === 'finished') {
                        $.when(
                            deleteNetworkServiceInstance(gatewayService, nsUri, instanceId)
                        ).then(
                            function(nsResponse) {
                                if(nsResponse.status === 'success') {
                                    remove();
                                } else {
                                    failFun(nsResponse);
                                }
                            }
                        ).fail(function() {
                            failFun({status: "fail", statusDescription: "delete service failed.", errorCode: "500"});
                        });
                    } else {
                        failFun(responseDesc);
                    }
                }
            );
        }
    ).fail(function() {
        failFun({status: "fail", statusDescription: "delete service failed.", errorCode: "500"});
    });
}

function deleteNetworkServiceInstance(gatewayService, nsUri, instanceId) {
    var instanceUri = nsUri + '/' + instanceId;
    var parameter = {
        'operation': "DELETE",
        'gatewayUri': instanceUri
    };
    return $.ajax({
        type: "POST",
        url: gatewayService,
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(parameter)
    });
}

function terminateNetworkServiceInstance(gatewayService, nsUri, instanceId) {
    var instanceUri = nsUri + '/' + instanceId;
    var nsTerminateUri = instanceUri + '/terminate';
    var terminateParameter = {
        'nsInstanceId': instanceId,
        'terminationType': "graceful",
        'gracefulTerminationTimeout': "60",
        'operation': "POST",
        'gatewayUri': nsTerminateUri
    };
    return $.ajax({
        type: "POST",
        url: gatewayService,
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(terminateParameter)
    });
}
