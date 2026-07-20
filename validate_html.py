import os
from html.parser import HTMLParser

class MyHTMLParser(HTMLParser):
    def __init__(self, filepath):
        super().__init__()
        self.filepath = filepath
        self.tags = []
        self.errors = []
        
        # Tags that don't need to be closed
        self.void_elements = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'svg', 'path'}

    def handle_starttag(self, tag, attrs):
        if tag not in self.void_elements:
            self.tags.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in self.void_elements:
            return
            
        if not self.tags:
            self.errors.append(f"{self.filepath}:{self.getpos()[0]}: Unexpected closing tag </{tag}>")
            return
            
        expected_tag, pos = self.tags.pop()
        
        # Allow some slight mismatches for robust HTML5, but we'll flag strict mismatches
        if expected_tag != tag:
            self.errors.append(f"{self.filepath}:{self.getpos()[0]}: Expected </{expected_tag}> (opened at {pos[0]}), got </{tag}>")
            # Pop until we match, to recover gracefully
            while self.tags:
                t, p = self.tags.pop()
                if t == tag:
                    break

def check_html(directory):
    total_errors = 0
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    parser = MyHTMLParser(filepath)
                    parser.feed(content)
                    
                    if parser.errors:
                        for err in parser.errors:
                            print(err)
                        total_errors += len(parser.errors)
                        
                    # We won't check unclosed tags at EOF because HTML5 permits it in some cases
                except Exception as e:
                    print(f"Error parsing {filepath}: {e}")
                    
    if total_errors == 0:
        print("No HTML closing tag mismatches found!")

if __name__ == "__main__":
    check_html("frontend")
