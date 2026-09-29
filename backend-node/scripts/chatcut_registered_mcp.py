"""Exec the user's already-registered official Desktop MCP; never print its env."""
import os
import pathlib
import sys
try:
    import tomllib
    config_home = pathlib.Path(os.environ.get('CODEX_HOME', pathlib.Path.home() / '.codex'))
    registration = tomllib.loads((config_home / 'config.toml').read_text())['mcp_servers']['chatcut_desktop']
    command = registration['command']
    if not pathlib.Path(command).is_absolute() or not pathlib.Path(command).is_file():
        raise ValueError('invalid executable')
    os.execve(command, [command, *registration.get('args', [])], {**os.environ, **registration.get('env', {})})
except Exception:
    sys.stderr.write('ChatCut Desktop registration unavailable; open the installed Desktop app. Python 3.11+ required.\n')
    sys.exit(1)
