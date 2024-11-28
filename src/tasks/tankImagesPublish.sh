#!/bin/bash
# Copy to /gui-part root with ./gui folder

aws --endpoint-url=https://storage.yandexcloud.net/ \
  s3 cp ./gui/maps/icons/vehicle s3://static.wotstat.info/vehicles/preview \
  --recursive \
  --exclude "*" \
  --include "*.png" \
  --exclude "*/**" \
  --cache-control 'max-age=31622400' \
  --profile wotstat