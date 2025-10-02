/**
 * Cross-component message enums and payloads
 */
export var Msg;
(function (Msg) {
    Msg["VAULT_READY"] = "VAULT_READY";
    Msg["AUTH_STATUS"] = "AUTH_STATUS";
    Msg["SHOW_VAULT"] = "SHOW_VAULT";
    Msg["HIDE_VAULT"] = "HIDE_VAULT";
    Msg["CHECK_PERMISSION"] = "CHECK_PERMISSION";
    Msg["GET_RELAYS"] = "GET_RELAYS";
    Msg["GET_PUBLIC_KEY"] = "GET_PUBLIC_KEY";
    Msg["SIGN_EVENT"] = "SIGN_EVENT";
    Msg["SIGN_DATA"] = "SIGN_DATA";
    Msg["ENCRYPT"] = "ENCRYPT";
    Msg["DECRYPT"] = "DECRYPT";
    Msg["GOT_ERROR"] = "GOT_ERROR";
    Msg["PROMPT_REQUIRED"] = "PROMPT_REQUIRED";
})(Msg || (Msg = {}));
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["LOCKED"] = "E_LOCKED";
    ErrorCode["PERMISSION_DENIED"] = "E_PERMISSION_DENIED";
    ErrorCode["TIMEOUT"] = "E_TIMEOUT";
    ErrorCode["ORIGIN_REJECTED"] = "E_ORIGIN_REJECTED";
    ErrorCode["INVALID_REQUEST"] = "E_INVALID_REQUEST";
    ErrorCode["INTERNAL"] = "E_INTERNAL";
})(ErrorCode || (ErrorCode = {}));
//# sourceMappingURL=messages.js.map