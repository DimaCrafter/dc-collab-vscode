import * as vscode from 'vscode';

const store = new class WrapperStore {
    cursors: { [mid: string]: Cursor } = {};
    documents: { [path: string]: Document } = {};
    activeDocument: Document | undefined;
};
export { store };

export function active (editor: vscode.TextEditor | undefined) {
    if (editor) {
        const path = editor.document.uri.path;
        if (!(path in store.documents)) {
            store.documents[path] = new Document();
        }
        store.activeDocument = store.documents[path];
        store.activeDocument.editor = editor;
        store.activeDocument.renderCursors();
    } else {
        store.activeDocument = undefined;
    }
}

interface CursorParsable {
    mid: string;
    color: string;
    nick: string;
    selections: [[
        { x: number, y: number },
        { x: number, y: number }
    ]];
}

export class Document {
    /**
     * Cursors collection that sorted by MachineID (`mid`) of owner
     */
    cursors: { [mid: string]: Cursor } = {};

    /**
     * Also renders cursor if document is active
     * @param obj `Cursor`-like object
     * @return `Cursor` instance
     */
    parseCursor (obj: CursorParsable): Cursor {
        let cursor: Cursor;
        if (obj.mid in this.cursors) cursor = this.cursors[obj.mid];
        else cursor = new Cursor();

        cursor.update({
            color: obj.color,
            nick: obj.nick,
            selections: obj.selections.map(s => new vscode.Range(s[0].y, s[0].x, s[1].y, s[1].x))
        });

        if (store.activeDocument == this) cursor.render(this._editor);
        this.cursors[obj.mid] = cursor;
        return cursor;
    }

    /**
     * Gets cursor by position in document
     * @param pos Position to match
     * @returns `Cursor` instance or `undefined` if no cursor at given position
     */
    getCursor (pos: vscode.Position): Cursor | undefined {
        const mid = Object.keys(this.cursors).find(mid => {
            return this.cursors[mid].isSelected(pos);
        });
        return mid ? this.cursors[mid] : undefined;
    }

    renderCursors () {
        for (const id in this.cursors) { this.cursors[id].render(this._editor); }
    }

    uri: vscode.Uri;
    private _editor: vscode.TextEditor;
    get editor () { return this._editor; }
    set editor (val: vscode.TextEditor | undefined) {
        if (val) {
            this.uri = val.document.uri;
            this._editor = val;
        }
    }
}

export class Cursor {
    update (obj: {}) { Object.assign(this, obj); }
    render (editor: vscode.TextEditor) {
        if (this._isChanged || !this.decoration) {
            this.decoration && this.decoration.dispose();
            this.decoration = vscode.window.createTextEditorDecorationType({
                // TODO: Any color to hex/rgba
                backgroundColor: this._color + '20', // ~44% of opacity
                //outline: '1px solid ' + this._color,
                after: {
                    contentText: '|',
                    width: '2px',
                    backgroundColor: this._color,
                    color: 'transparent',
                    margin: '0 0 0 -2px'
                }
            });
            editor.setDecorations(this.decoration, this.selections);
        }
    }

    selections: [vscode.Range];
    isSelected (pos: vscode.Position) {
        return !!this.selections.find(s => s.contains(pos));
    }

    decoration: vscode.TextEditorDecorationType;
    private _isChanged = false;

    // TODO: Make this shorter
    private _nick: string;
    get nick () { return this._nick; }
    set nick (val: string) {
        if (val != this._nick) this._isChanged = true;
        this._nick = val;
    }

    private _color: string;
    get color () { return this._color; }
    set color (val: string) {
        if (val != this._color) this._isChanged = true;
        this._color = val;
    }
}