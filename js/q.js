/*
spotify:app:q:track:5oD2Z1OOx1Tmcu2mc9sLY2
*/

/*

Modes:
1. Track change playContext (ruins playlists in non-default sort order like recently added)
2. Manual
3. Track change playTrack (skips the next n playing songs where n is the length of the queue)

Previous Contexts
1. radio
2. nothing
3. soundrop
4. playlist

Player variables
1. shuffle
2. repeat

*/

var MODE = {
    PLAYCONTEXT: 1,
    MANUAL: 2,
    PLAYTRACK: 3
};

require(['$api/models', '$views/list#List', '$views/buttons'], function(models, List, buttons) {

    models.Playlist.createTemporary('q').done(function(plStub) {
        g.temp = plStub;

        log('Created playlist ' + g.temp.uri)

        g.temp.addEventListener('insert', qInsert);
        g.temp.addEventListener('remove', qRemove);
        g.temp.addEventListener('change:tracks', qChange);
        g.temp.load('tracks').done(function(pl){
            g.tempCache = pl;
        });

        g.qlist = List.forPlaylist(g.temp);
        $('#playlist').append(g.qlist.node);
        g.qlist.init();
    });

    $('#r-all').click(function(){
        g.temp.load('tracks').done(function(pl){
            pl.tracks.clear();
            g.qlen = 0;
        });
        $(this).atr('disabled', 'disabled');
    });

    $('#r-log').click(function(){
        g.cnt = 0;
        $('#log').empty();
    });

    // args
    models.application.load('arguments').done(handleArgs);
    models.application.addEventListener('arguments', handleArgs);

    // wait for change event and play from queue
    log('Adding queue listener');
    models.player.addEventListener('change:track', tryPlayingFromQ);
    models.player.addEventListener('change:playing', playingChanged);

    function handleArgs() {
        var args = models.application.arguments;

        if (args && args.length) {
            if (args[0] === 'track') {
                // get track arg
                var tid = 'spotify:track:' + args[1];
                addToQ(tid);

                // save context
                models.player.load('context', 'index').done(function(p) {
                    if (p.context && g.temp && p.context.uri !== g.temp.uri) {
                        log('Context is ' + p.context.uri);
                        log('Position is ' + p.index)
                        g.ctx = p.context;
                        g.idx = p.index;
                    }
                });
            }
       }
    }

    function addToQ(tid) {
        tid = $.trim(tid);
        addTrack(tid);
    }

    function addTrack(tid) {
        if (g.temp) {
            g.temp.load('tracks').done(function(pl){
                pl.tracks.add(models.Track.fromURI(tid));
            });
        }
    }

    function remove(trackChanged) {
        if (g.temp && !trackChanged.oldValue.advertisement) {
            g.temp.load('tracks').done(function(pl){
                pl.tracks.snapshot(0,1).done(function (snapshot) {
                    if (snapshot.length) {
                        models.player.load('repeat', 'shuffle').done(function(p){
                            // repeat mode shouldn't delete track...
                            if (p.repeat) {
                                log('Not removing, is on repeat.');
                                return;
                            } else {
                                // what if this track exists multiple times?
                                log('Trying to remove', trackChanged.oldValue.name);
                                log(snapshot.find(trackChanged.oldValue));
                                pl.tracks.remove(snapshot.find(trackChanged.oldValue));
                            }
                        });
                    }
                });
            });
        }
    }

    function removeAll() {
        g.temp.load('tracks').done(function(pl){
            pl.tracks.clear();
            g.qlen = 0;
            g.qlist.refresh();
        });
    }

    function resumePrevContext() {
        if (g.ctx) {
            models.player.playContext(g.ctx, g.idx + 1);
        }
    }

    function shortenUri(uri) {
        var magic = 'spotify:track:';
        if (uri && uri.indexOf(magic) != -1) {
            return uri.split(magic)[1];
        }
        return uri;
    }

    function playingChanged(playing) {
        var inContext = amInContext(playing);

        if (g.mode === MODE.PLAYCONTEXT) {
            // end of temp playlist?
            if (inContext && playing.oldValue) {
                log('End of queue');
                removeAll();
                resumePrevContext();
            }
        }
    }

    function qInsert(e) {
        g.qlen++;
        $('#r-all').removeAttr('disabled');
    }

    function qRemove(e) {
        g.qlen--;
        if (g.qlen === 0) {
            $('#r-all').attr('disabled','disabled');
            if (g.mode === MODE.PLAYCONTEXT) {
                resumePrevContext();
            }
        }
    }

    function qChange(e) {
        g.qlist.refresh();
    }

    function tryPlayingFromQ(trackChanged) {
        log('Track was: ' + trackChanged.oldValue.name);
        log('Track now: ' + trackChanged.target.track.name);

        var inContext = amInContext(trackChanged);
        log('Am I in context? ' + inContext);

        switch (g.mode) {
            case MODE.PLAYCONTEXT:
                if (g.qlen) {
                    if (!inContext) {
                        trackChanged.target.playContext(g.temp);
                        g.firstPlay = true;
                        log('set first play to true');
                    } else  {
                        if (!g.firstPlay) {
                            remove(trackChanged);
                        } else {
                            g.firstPlay = false;
                            log('set first play to false');
                        }
                        log('Playing : ' + trackChanged.target.track.name);
                    }
                }
                break;
            case MODE.MANUAL:
                break;
            default:
                break;
        }
    }

    function amInContext(trackChanged) {
        var isContextThisApp = false;
        if (trackChanged.target.context && g.temp && trackChanged.target.context.uri === g.temp.uri) {
            isContextThisApp = true;
        }
        return isContextThisApp;
    }

    function log(str, obj, area) {
        if (g.debug) {
            g.cnt++;
            var msg = '[' + g.cnt.toString().paddingLeft("000") + '] ' + str;
            if (obj) {
                msg += ' : ' + obj.toString();
                console.log(obj);
            }
            console.log(msg);
            $('#log').prepend('<div>' + msg + '</div>');
        }
    }

    function htmlEscape(str) {
        return String(str)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
    }

}); // require