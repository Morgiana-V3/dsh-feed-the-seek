import * as React from 'react';
import { displayName } from './components.js';
export function PersonaName({ state, isBusy, submitAction, notify, }) {
    const [editing, setEditing] = React.useState(false);
    const [name, setName] = React.useState('');
    const persona = state.personas.find((entry) => entry.id === state.scope.persona);
    async function save(event) {
        event.preventDefault();
        const result = await submitAction('persona/rename', { scope: state.scope, name: name.trim() });
        if (result) {
            setEditing(false);
            notify('伙伴名字已更新');
        }
    }
    if (!editing) {
        return (React.createElement("button", { type: "button", className: "fish-text-button", disabled: isBusy, onClick: () => {
                setName(displayName(persona?.name) === persona?.name ? persona.name : '');
                setEditing(true);
            } }, "\u6539\u540D"));
    }
    return (React.createElement("form", { className: "fish-name-form", onSubmit: (event) => void save(event) },
        React.createElement("label", null,
            "\u4F19\u4F34\u540D\u5B57",
            React.createElement("input", { autoFocus: true, required: true, maxLength: 40, value: name, onChange: (event) => setName(event.target.value), placeholder: "\u7ED9\u5979\u8D77\u4E2A\u540D\u5B57" })),
        React.createElement("button", { className: "fish-button fish-button-small", disabled: isBusy || !name.trim(), type: "submit" }, "\u4FDD\u5B58"),
        React.createElement("button", { className: "fish-text-button", disabled: isBusy, type: "button", onClick: () => setEditing(false) }, "\u53D6\u6D88")));
}
//# sourceMappingURL=persona-name.js.map