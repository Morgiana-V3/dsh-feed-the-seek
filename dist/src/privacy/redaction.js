/** Redact before persistence and before any background-model request. Never log credential bodies. */
export function redactSecrets(text) {
    return text
        .replace(/\b(?:sk|pst)-[a-zA-Z0-9_-]{8,}\b/g, '[凭据已隐藏]')
        .replace(/\bBearer\s+[a-zA-Z0-9._~+\/-]{8,}={0,2}/gi, 'Bearer [凭据已隐藏]')
        .replace(/((?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|密码|密钥)["']?\s*[:=：]\s*["']?)([^\s"',;，；}]{8,})/gi, '$1[凭据已隐藏]');
}
export function safeSource(source) {
    return { ...source, text: redactSecrets(source.text) };
}
export function redactJsonText(text) {
    return JSON.stringify(JSON.parse(text, (_key, value) => (typeof value === 'string' ? redactSecrets(value) : value)));
}
//# sourceMappingURL=redaction.js.map