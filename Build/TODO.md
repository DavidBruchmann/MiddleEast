# TODO

* consider individual content w/o 100% reliance on wikipedia
  i.e. publication of book as event if only mentioned on person-page
* consider other views, i.e. for persons / groups
* consider several pages which don't use the same script

## Build/download.js

* substitute single downloads / append downloads to:
  * OUTPUT_FILE (public/data.json)
  * REGISTRY_FILE (Build/wikipedia_cache/cache_registry.json)
  Don't replace the whole file contents.
* ~~add advanced birth-date detection~~
* add events
* add media registry with all data
* outsource download-list as json-file with categories like event, person, group, etc.
  including optional item-description for the script-user / -maintainer.

## Build/prepare.js

* ~~update advanced birth-date detection~~

## Build/parse.js

* ~~text and translations aren't shown~~
* maybe take texts from already stored txt files
* strip out phonetics perhaps
* allow section links like #History
* ~~wiki badges aren't shown~~
* Filter garbage from content like "This article may rely excessively on sources too closely associated with the subject , potentially preventing it from being verifiable and neutral . Please help improve this article by replacing such sources with more appropriate citations to reliable, independent sources . ( December 2025 )"

## public/index.html

* ~~outsource JavaScript in assets/JavaScript/events.js~~
* styling, especially cursor type
* translate more labels, change label texts
* synchronize clicked items between timeline, list and detail-view
* [QUESTION] How are persons / groups used content-related?
* add lightbox for images
* media: display caption with license, source and title, perhaps more
  requires media registry
* make markup (more) accessible, i.e cards in even-list

### vis-timeline

* fix issue with rtl/ltr on language change
* add popups for titles only
* add line-marker for official declaring of Israel

