#!/usr/bin/env bash
# Resets everything localhost-mapper touches, for when an interrupted run
# leaves state behind. macOS only.

set -u

rm -f ~/.lhmapper*
pkill -f pac-server || true

while IFS= read -r nic; do
  /usr/sbin/networksetup -setautoproxyurl "$nic" " "
  /usr/sbin/networksetup -setautoproxystate "$nic" off
done < <(/usr/sbin/networksetup -listallnetworkservices | tail -n +2)
