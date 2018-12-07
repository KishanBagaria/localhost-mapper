#!/usr/bin/env bash

set -ux

rm ~/.lhmapper*
pkill -f pac-server

IFS=$'\n'
for nic in $(/usr/sbin/networksetup -listallnetworkservices | tail +2)
do
  /usr/sbin/networksetup -setautoproxyurl "$nic" " "
  /usr/sbin/networksetup -setautoproxystate "$nic" off
done
