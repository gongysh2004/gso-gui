$(function(){
	$('.creat-btn').click(function(){
				$('#vmAppDialog').addClass('in').css({'display':'block'});
				
			});
			$('.close,.button-previous').click(function(){
				$('#vmAppDialog').removeClass('in').css('display','none');
			});
			$('.detail-top ul li').click(function(){
				$(this).addClass('current').siblings().removeClass('current');
			});
			$('.para').click(function(){				
				if($('#serviceTemplateName').val() == ''){
					alert('Please choose the service templet！');
					$('#flavorTab').css('display','none');
				}else{
					$('#flavorTab').css('display','block');
				}
				$('#basicTab').css('display','block');
			});
			$('.basic').click(function(){
				$('#flavorTab').css('display','none');
			});
			
			$('.table tbody tr').click(function(){
				$(this).addClass('openoTable_row_selected').siblings().removeClass('openoTable_row_selected');
			});
			$('.table tr:odd').addClass('active');
			$('#false').click(function(){
				$('#vmAppDialog').addClass('in').css({'display':'block'});
			});
			$('.close,.button-previous').click(function(){
				$('#vmAppDialog').removeClass('in').css('display','none');
			});
			$('#filterTpLogicalType').click(function(){
				$('#filterTpLogicalType_select_popupcontainer').toggleClass('openo-hide');
				$('#filterTpLogicalType').toggleClass('openo-focus');
				var oLeft = $('#open_base_tpL_td6').offset().left;
			var oTop = $('#open_base_tpL_td6').offset().top;
			var oHeight = $('#open_base_tpL_td6').height();
			$('#filterTpLogicalType_select_popupcontainer').css({'left':oLeft,'top':oTop + oHeight + 10});
			});
			$('div.openo-select-popup-container>div.openo-select-item>label').click(function(){
				var Lvalue = $(this).html();
				$('#filterTpLogicalType_select_input').attr('value',Lvalue);
				$('#filterTpLogicalType_select_popupcontainer').addClass('openo-hide');
				$('#filterTpLogicalType').removeClass('openo-focus');
			});
			$.fn.serializeObject = function() {
				var o = {};
				var a = this.serializeArray();
				$.each(a, function() {
					if (o[this.name] !== undefined) {
						if (!o[this.name].push) {
							o[this.name] = [ o[this.name] ];
						}
					o[this.name].push(this.value || '');
					} else {
						o[this.name] = this.value || '';
					}
				});
			return o;
			};
	
$('#createNS').click(function(){
				var formData = JSON.stringify($("#neForm").serializeObject());
				var jsonobj = JSON.parse(formData);
		        var newJson = {"managedElement": jsonobj};
		        formData = JSON.stringify(newJson);
		        var requestUrl = "http://localhost:8080/org.openo.sdno.brs/openoapi/sdnobrs/v1/managed-elements";
		        $
				.ajax({
					type : "POST",
					url : requestUrl,
					contentType : "application/json",
					dataType : "json",
					data : formData,
					success : function(jsonResp) {
						alert("NS saved successfully!!!");
						jsonobj["id"]= jsonResp.managedElement.id;
						$('#ne').bootstrapTable("append", jsonobj);
						$('#vmAppDialog').removeClass('in').css('display','none');

					},
					error : function(xhr, ajaxOptions, thrownError) {
						alert("Error on page : " + xhr.responseText); 	
					}
				});
			});
})