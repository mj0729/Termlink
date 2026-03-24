export const TERMLINK_MARKER_PREFIX = '\u001fTERMLINK_'
export const TERMLINK_CWD_MARKER_PREFIX = '\u001fTERMLINK_CWD:'
export const TERMLINK_BOOTSTRAP_ECHO_TOKEN = '__TERMLINK_BOOTSTRAP=1;'
export const TERMLINK_PROMPT_START_MARKER = `${TERMLINK_MARKER_PREFIX}PROMPT_START\u001f`
export const TERMLINK_PROMPT_END_MARKER = `${TERMLINK_MARKER_PREFIX}PROMPT_END\u001f`

const SHELL_INTEGRATION_SCRIPT = String.raw`
if [ -z "\${TERMLINK_SHELL_INTEGRATION_READY:-}" ]; then
  export TERMLINK_SHELL_INTEGRATION_READY=1

  __termlink_emit_marker() {
    printf '\037TERMLINK_%s\037' "$1"
  }

  __termlink_emit_cwd() {
    printf '\037TERMLINK_CWD:%s\037' "$PWD"
  }

  if [ -n "\${ZSH_VERSION:-}" ]; then
    autoload -Uz add-zsh-hook 2>/dev/null || true

    __termlink_precmd() {
      __termlink_emit_cwd
    }

    if whence add-zsh-hook >/dev/null 2>&1; then
      add-zsh-hook precmd __termlink_precmd
    else
      precmd_functions+=(__termlink_precmd)
    fi

    case "\${PROMPT:-}" in
      *TERMLINK_PROMPT_START*) ;;
      *)
        PROMPT=$'%{\037TERMLINK_PROMPT_START\037%}'"\${PROMPT}"$'%{\037TERMLINK_PROMPT_END\037%}'
        ;;
    esac
  elif [ -n "\${BASH_VERSION:-}" ]; then
    __termlink_prompt_command() {
      __termlink_emit_cwd
    }

    if [ -n "\${PROMPT_COMMAND:-}" ]; then
      PROMPT_COMMAND="__termlink_prompt_command; \${PROMPT_COMMAND}"
    else
      PROMPT_COMMAND="__termlink_prompt_command"
    fi

    case "\${PS1:-}" in
      *TERMLINK_PROMPT_START*) ;;
      *)
        PS1=$'\001\037TERMLINK_PROMPT_START\037\002'"\${PS1}"$'\001\037TERMLINK_PROMPT_END\037\002'
        ;;
    esac
  fi

  __termlink_emit_marker PROMPT_START
  __termlink_emit_cwd
  __termlink_emit_marker PROMPT_END
fi
`

export function buildShellIntegrationBootstrap() {
  return `${TERMLINK_BOOTSTRAP_ECHO_TOKEN}${SHELL_INTEGRATION_SCRIPT}\r`
}
