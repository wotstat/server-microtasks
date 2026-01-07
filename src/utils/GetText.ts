export class GetText {

  private transitions: Map<string, string>

  constructor(po: string) {
    const translations = po.split('msgid');

    const parsed = translations
      .filter(t => t.includes('msgstr'))
      .map(t => {
        const splitted = t.split('msgstr');
        const msgid = splitted[0].trim().slice(1, -1);

        const lines = splitted[1]
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0)
          .map(l => l.slice(1, -1))
          .filter(l => l.length > 0);

        const msgstr = lines.join('\n');

        return {
          msgid,
          msgstr: msgstr == '?empty?' ? '' : msgstr
        }
      })

    this.transitions = new Map(parsed.map(t => [t.msgid, t.msgstr]))
  }

  public getTranslation(msg: string, fallback?: string) {
    return this.transitions.get(msg) ?? fallback ?? msg
  }

  public getSingleLineTranslation(msg: string, fallback?: string) {
    return (this.transitions.get(msg) ?? fallback ?? msg)
      .replaceAll('\n', ' ')
      .replaceAll('\\n', ' ')
      .replaceAll(/\s+/g, ' ')
  }

  public getAll() {
    return this.transitions
  }
}
