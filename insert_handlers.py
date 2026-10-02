import re

with open('D:/SilenX/frontend/src/components/ChatView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

handlers = '''
  // ── WhatsApp-Style Full Message Stack Selection Mode ──
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

  const toggleSelectMessage = useCallback((id: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMessageIds([]);
  }, []);

  const handleSelectAction = useCallback((action: "copy" | "star" | "forward" | "delete" | "reply") => {
    const selectedIds = selectedMessageIds;
    if (selectedIds.length === 0) return;
    const selectedMessages = currentMessages.filter((m) => selectedIds.includes(m.id));

    switch (action) {
      case "copy": {
        const combinedText = selectedMessages
          .map((m) => m.text)
          .filter(Boolean)
          .join("\\n\\n");
        if (combinedText) {
          navigator.clipboard.writeText(combinedText).then(
            () => showToast("Copied to clipboard"),
            () => showToast("Copy failed — please copy manually")
          );
        }
        break;
      }
      case "star": {
        const target = currentMessages.find((m) => m.id === selectedIds[0]);
        if (activeConversationId) {
          const updatedMessages = (messages[activeConversationId] || []).map((msg) =>
            selectedIds.includes(msg.id) ? { ...msg, isStarred: !msg.isStarred } : msg
          );
          setMessages(activeConversationId, updatedMessages);
        }
        showToast(target?.isStarred ? "Unstarred" : "Starred");
        break;
      }
      case "forward": {
        window.alert("Forwarding is ready for the next step.");
        break;
      }
      case "delete": {
        if (activeConversationId) {
          selectedIds.forEach((id) => {
            deleteMessage(activeConversationId, id);
          });
        }
        break;
      }
      case "reply": {
        const target = currentMessages.find((m) => m.id === selectedIds[0]);
        if (target) {
          setReplyTo({ sender: target.isSelf ? "You" : chatName, text: target.text });
        }
        break;
      }
    }
    clearSelection();
  }, [activeConversationId, chatName, clearSelection, currentMessages, deleteMessage, messages, setMessages, showToast]);

  const handleReplySelected = useCallback(() => {
    handleSelectAction("reply");
  }, [handleSelectAction]);
'''

# Insert after statusText declaration, before 'return ('
pattern = r"(  const statusText = activeConvo\.type === 'group' \n     ? `\$\{activeConvo\.members\.length\} participants` \n     : \(status === 'online' \? 'Online' : formattedLastSeen === 'Offline' \? 'Offline' : `Last seen \$\{formattedLastSeen\}`\);\n)\n(  return \()"
replacement = r'\1' + handlers + r'\n\2'
new_content = re.sub(pattern, replacement, content)

with open('D:/SilenX/frontend/src/components/ChatView.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Done')
