import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";

/**
 * Auto-formatting extension for Notion-like behavior
 * Handles:
 * - # for headings
 * - > for blockquotes
 * - - or * for bullet lists
 * - 1. for ordered lists
 * - ``` for code blocks
 * - --- for horizontal rules
 * - Smart text replacement (arrows, dashes, etc.)
 */
export const AutoFormatExtension = Extension.create({
  name: "autoFormat",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("autoFormat"),
        props: {
          handleTextInput: (view: EditorView, from: number, to: number, text: string) => {
            // Only process space key
            if (text !== " ") return false;

            const $from = view.state.doc.resolve(from);
            const textBefore = $from.parent.textContent.substring(0, $from.parentOffset);

            // Check for markdown patterns
            const patterns = [
              { regex: /^# $/, command: "heading", attrs: { level: 1 } },
              { regex: /^## $/, command: "heading", attrs: { level: 2 } },
              { regex: /^### $/, command: "heading", attrs: { level: 3 } },
              { regex: /^#### $/, command: "heading", attrs: { level: 4 } },
              { regex: /^> $/, command: "blockquote", attrs: {} },
              { regex: /^- $/, command: "bulletList", attrs: {} },
              { regex: /^\* $/, command: "bulletList", attrs: {} },
              { regex: /^1\. $/, command: "orderedList", attrs: {} },
              { regex: /^--- $/, command: "horizontalRule", attrs: {} },
            ];

            for (const pattern of patterns) {
              if (pattern.regex.test(textBefore)) {
                // Delete the pattern text
                const deleteFrom = $from.start();
                const deleteTo = from;
                view.dispatch(
                  view.state.tr
                    .delete(deleteFrom, deleteTo)
                    .insertText(" ")
                );

                // Apply the command
                if (pattern.command === "heading") {
                  view.dispatch(
                    view.state.tr.setBlockType(
                      view.state.selection.$from.before(),
                      view.state.selection.$from.after(),
                      view.state.schema.nodes.heading,
                      pattern.attrs
                    )
                  );
                } else if (pattern.command === "blockquote") {
                  view.dispatch(
                    view.state.tr.setBlockType(
                      view.state.selection.$from.before(),
                      view.state.selection.$from.after(),
                      view.state.schema.nodes.blockquote
                    )
                  );
                } else if (pattern.command === "bulletList") {
                  // Create bullet list
                  const { $from: $newFrom } = view.state.selection;
                  const listNode = view.state.schema.nodes.bulletList.create(
                    {},
                    view.state.schema.nodes.listItem.create(
                      {},
                      view.state.schema.nodes.paragraph.create()
                    )
                  );
                  view.dispatch(
                    view.state.tr.replaceRangeWith(
                      $newFrom.before(),
                      $newFrom.after(),
                      listNode
                    )
                  );
                } else if (pattern.command === "orderedList") {
                  // Create ordered list
                  const { $from: $newFrom } = view.state.selection;
                  const listNode = view.state.schema.nodes.orderedList.create(
                    {},
                    view.state.schema.nodes.listItem.create(
                      {},
                      view.state.schema.nodes.paragraph.create()
                    )
                  );
                  view.dispatch(
                    view.state.tr.replaceRangeWith(
                      $newFrom.before(),
                      $newFrom.after(),
                      listNode
                    )
                  );
                } else if (pattern.command === "horizontalRule") {
                  // Insert horizontal rule
                  const { $from: $newFrom } = view.state.selection;
                  const hrNode = view.state.schema.nodes.horizontalRule.create();
                  view.dispatch(
                    view.state.tr
                      .replaceRangeWith($newFrom.before(), $newFrom.after(), hrNode)
                      .insertText("\n")
                  );
                }

                return true;
              }
            }

            // Smart text replacement
            const smartReplacements: Record<string, string> = {
              "->": "→",
              "<-": "←",
              "=>": "⇒",
              "<=": "⇐",
              "--": "–",
              "---": "—",
              "(c)": "©",
              "(R)": "®",
              "(tm)": "™",
              "...": "…",
            };

            for (const [pattern, replacement] of Object.entries(smartReplacements)) {
              if (textBefore.endsWith(pattern)) {
                const start = from - pattern.length;
                view.dispatch(
                  view.state.tr
                    .delete(start, from)
                    .insertText(replacement + " ")
                );
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
