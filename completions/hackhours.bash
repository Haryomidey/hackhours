_hackhours_completions()
{
  local cur prev opts
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  opts="init start stop today week month stats languages projects files --from --to --help --version"

  if [[ ${cur} == -* ]] ; then
    COMPREPLY=( $(compgen -W "--from --to --help --version" -- ${cur}) )
    return 0
  fi

  COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
  return 0
}

complete -F _hackhours_completions hackhours
