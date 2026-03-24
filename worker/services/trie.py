# services/trie.py

class TrieNode:
    def __init__(self):
        self.children = {}
        self.task_ids = []  # stores IDs of tasks at this node


class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str, task_id: str):
        """Insert every prefix of word into trie."""
        node = self.root
        for char in word.lower():
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
            if task_id not in node.task_ids:
                node.task_ids.append(task_id)

    def search(self, prefix: str) -> list[str]:
        """Return all task IDs matching this prefix."""
        node = self.root
        for char in prefix.lower():
            if char not in node.children:
                return []
            node = node.children[char]
        return node.task_ids

    def build_from_tasks(self, tasks):
        """Build trie from a list of SearchSchema tasks."""
        for task in tasks:
            # Index by every word in the task name
            for word in task.name.lower().split():
                self.insert(word, task.id)
            # Also index by full name prefix
            self.insert(task.name, task.id)