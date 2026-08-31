#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return



# terminal prompt start
alias ls='ls --color=auto'
alias grep='grep --color=auto'
# old PS1
# PS1='[\u@\h \W]\$ '
# new PS1
parse_git_branch() {
    local branch
    branch=$(git branch --show-current 2>/dev/null)
    [[ -n "$branch" ]] && echo "[$branch] "
}

PS1='\[\e[1;96m\]\u@\h \[\e[1;95m\]\W \[\e[1;92m\]$(parse_git_branch)\[\e[1;97m\]❯\[\e[0m\] '
# terminal prompt end






. /usr/share/nvm/init-nvm.sh






# >>> Codex installer >>>
export PATH="/home/ankit/.local/bin:$PATH"
# <<< Codex installer <<<


# pnpm local store start
alias pnpmins='pnpm install --store-dir .pnpm-store'
#end
