extends Node
class_name OpenCodeClient
var endpoint: String = ""
var api_key: String = ""

func _init(_endpoint: String = "", _api_key: String = ""):
    endpoint = _endpoint
    api_key = _api_key

func send_request(prompt: String, callback):
    var response = {"choices": [{"text": "Generated code here"}]}
    callback(response)
