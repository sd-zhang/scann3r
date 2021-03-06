
var Scann3r = {

    sio: null,

    start: function () {
        this.sio = io({path: "/ws"});
        this.switchNav(location.hash == '' ? 'control' : location.hash);
        this.initHandler();
        this.initSioHandler();
        this.crop.init();
        this.gallery.init();
        this.gallery.loadPage(0);
        this.toasts = [];
        this.sio.emit('ready');
    },

    showWebsocketError() {
        $('#websocketError').remove();
        $('body').append('<div id="websocketError" style="position:fixed;right:0;bottom:0;background-color:#f00;color:#fff;font-weight:bold;;padding:5px;">websocket not connected!</div>');
    },

    hideWebsocketError() {
        $('#websocketError').remove();
    },

    initSioHandler() {
        this.sio.on('connect', () => {
            this.hideWebsocketError();
        });

        this.sio.on('disconnect', () => {
            if (!window.isUnloading) {
                this.showWebsocketError();
            }
        })

        this.sio.on('connect_error', () => {
            this.showWebsocketError();
        });

        this.sio.on('proxy', (data) => {
            $('.proxy-url').html(data.url);
            $('#dev-down').attr('href', data.url);
            $("#dialog-cloud").dialog(
                {
                    width: 600,
                    height: 300
                }
            );
        });

        this.sio.on('toastClose', (id) => {
            if (typeof this.toasts[id] != 'undefined') {
                this.toasts[id].close();
            }
        });

        this.sio.on('info', (id, text) => {
            $('.' + id).text(text);
        });

        this.sio.on('toast', (data) => {
            let toast = {
                heading: data.heading,
                text: data.text,
                position: 'bottom-right',
                hideAfter: false,
                loader: false,
                sticky: true,
            }

            if (typeof this.toasts[data.id] != 'undefined') {
                this.toasts[data.id].update(toast);
                this.toasts[data.id].loader(data.percent);
            } else {
                this.toasts[data.id] = $.toast(toast);
            }
        });

        this.sio.on("progress", (data) => {
            for (n in data) {
                $('.progress-' + n).text(data[n]);
            }
        });

        this.sio.on('updateCameraPreview', (data) => {
            $('#myCam').attr('src', data);
            $('#myCamDate').html(new Date().toISOString());
        });

        this.sio.on('setSliderValue', (name, value) => {
            if (! $('.slider[data-slider=' + name + ']').hasClass('ui-widget')) {
                return; // not initialized yet
            }

            let key = (typeof value == 'object') ? 'values' : 'value';
            $('.slider[data-slider=' + name + ']').slider(key, value);
        });

        this.sio.on('initSlider', this.slider.init);

        this.sio.on("disableControls", () => {
            $('.slider').slider('disable');
            $('.js-start').hide();
            $('.js-abort').show();
            this.crop.disable();
        });

        this.sio.on("enableControls", () => {
            $('.slider').slider('enable');
            $('.js-start').show();
            $('.js-abort').hide();
            this.crop.enable();
        });

        this.sio.on('invert', (value) => {
            $('#js-invert').prop('checked', value);
        });

        this.sio.on("newProject", (data) => {
            let t1 = this.gallery.createThumb(data);
            let t2 = this.gallery.createThumb(data);
            $(t2).attr('id', 'newest');
            this.gallery.prepend(t1);
            $('#dialog-finished').html(t2)
                .dialog({
                    width: 350,
                    height: 550
                });
        });

        this.sio.on("imgArea", this.crop.change);
    },

    initHandler: function () {
        var self = this;
        $('.js-start').click(() => {
            self.sio.emit('start');
        });

        $('.js-abort').click(() => {
            self.sio.emit('abort');
        });

        $('.js-calibrate').click(() => {
            $("#dialog-calibrate").dialog({
                width: 500,
                height: 300
            });
        });

        $('.js-rotor-move').click(function () {
            self.sio.emit('rotorCalibrate', $(this).data('steps'));
        });

        $('#js-invert').change(() => {
            self.sio.emit('rotorCalibrateDirection', $('#js-invert').prop('checked'));
        });

        $('.js-calibrate-done').click(() => {
            self.sio.emit('rotorCalibrateSetHome');
            $("#dialog-calibrate").dialog('close');
        });

        $('.js-turntable-sethome').click(() => {
            self.sio.emit('turntableCalibrateSetHome');
        });

        $('.js-nav').click(function (e) {
            self.switchNav($(this).attr('href'));
        });

    }
    ,

    switchNav: (hash) => {
        let section = hash.replace('#', '');
        $(".ui-dialog-content").dialog("close");
        $('.content').hide();
        $('#c-' + section).show();
        switch (section) {
            case 'control':
                Scann3r.crop.show();
                break;
            default:
                Scann3r.crop.hide();
                break;
        }
    },

    crop:
        {
            instance: null,
            data:
                {}
            ,
            init: () => {
                Scann3r.crop.instance = $('#myCam').imgAreaSelect({
                    instance: true,
                    handles: true,
                    show: true,
                    onSelectEnd: function (img, selection) {
                        let xf = 100 / img.width;
                        let yf = 100 / img.height;
                        let relativeSelection = {x: selection.x1 * xf, y: selection.y1 * yf, width: selection.width * xf, height: selection.height * yf};
                        Scann3r.sio.emit('imgArea', relativeSelection);
                        if (!selection.width || !selection.height) {
                            return;
                        }
                    }
                });
            },
            change:
                (data) => {
                    let w = $('#myCam').width() / 100;
                    let h = $('#myCam').height() / 100;
                    Scann3r.crop.instance.setSelection(data.x * w, data.y * h, data.x * w + data.width * w, data.y * h + data.height * h)
                    Scann3r.crop.instance.update();
                    Scann3r.crop.data = data;
                },
            setOption:
                (key, value) => {
                    if (Scann3r.crop.instance != null) {
                        let options = {}
                        options[key] = value;
                        Scann3r.crop.instance.setOptions(options);
                    }
                },
            disable:
                () => Scann3r.crop.setOption('disable', true),
            enable:
                () => Scann3r.crop.setOption('enable', true),
            hide:
                () => Scann3r.crop.setOption('hide', true),
            show:
                () => {
                    if (Scann3r.crop.instance != null) {
                        Scann3r.crop.change(Scann3r.crop.data);
                    }
                    Scann3r.crop.setOption('show', true);
                }


        }
    ,

    slider: {
        init: (name, options) => {
            options.name = name;
            let slider = $(`.slider[data-slider=${name}]`);
            let sliderOptions = {
                min: options.range.min,
                max: options.range.max,
                range: (typeof options.values != 'undefined'),
                slide: (event, ui) => Scann3r.slider.setValue(event, ui, name, options),
                change: (event, ui) => Scann3r.slider.setValue(event, ui, name, options),
            }
            if (typeof options.steps != 'undefined') {
                options.step = options.step;
            }
            slider.slider(sliderOptions);
            if (typeof options.values != 'undefined') {
                slider.slider('values', options.values);
                $('.slider[data-slider=rotorAngleRangeToScan]').slider('values', options.values);
            }
            if (typeof options.value != 'undefined') {
                slider.slider('value', options.value);
            }
        },
        setValue:

            function (event, ui, name, options) {

                let displayValue = (val, formated) => {
                    let displayValue = (val * (options.displayRange.max - options.displayRange.min) / (options.range.max - options.range.min));
                    if (formated) {
                        displayValue = displayValue.toFixed(options.displayDecimals ?? 0);
                        displayValue += options.displaySuffix;
                    }
                    return displayValue;

                }
                if (typeof ui.values != 'undefined') { // range slider
                    for (let index in ui.values) {
                        $('#val-' + name + '-' + index).text(displayValue(ui.values[index], 1));
                    }
                } else {
                    $('#val-' + name).text(displayValue(ui.value, 1));
                }

                if (name == 'rotor' || name == 'rotorAngleRangeToScan') {
                    $('.os-ring-preview').show();
                    $('.os-ring-preview').css('transform', 'rotate(' + displayValue(ui.value) + 'deg)');
                }

                if (typeof event.originalEvent != 'undefined') {
                    let value = typeof ui.values != 'undefined' ? ui.values : ui.value;
                    Scann3r.sio.emit('slider', event.type, name, value);
                }
                if (event.type == 'slidechange') {
                    $('.os-ring-preview').hide();

                    if (typeof event.originalEvent == 'undefined' && name == 'rotor') {
                        $('.os-ring').css('transform', 'rotate(' + displayValue(ui.value) + 'deg)');
                    }
                }
            }
    },

    gallery: {
        init: (sio) => {
            this.sio = sio;
            this.template = $('#thumb-template').clone();
            $('#thumb-template').remove();
        },
        loadPage: function (page) {
            let x = Scann3r.sio.emit('getProjects', 0, 100, (r) => {
                for (let n in r) {
                    this.append(this.createThumb(r[n]));
                }
            });
        },


        createThumb: (data) => {
            let humanReadableFilesize = (bytes) => {
                if (bytes < 1024) {
                    return bytes + ' bytes';
                } else if (bytes < 1024 * 1024) {
                    return (bytes / 1024).toFixed(1) + ' KB';
                } else if (bytes < 1024 * 1024 * 1024) {
                    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
                } else {
                    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
                }
            };


            let t = this.template.clone();
            t.attr('id', 'foo');
            t.addClass('thumb-' + data.id);

            t.find('.t-delete').click(() => {
                if (confirm('Are you sure?')) {
                    Scann3r.sio.emit('delete', data.id, (err, r) => {
                        if (err) {
                            alert(err);
                        } else {
                            $('.thumb-' + data.id).remove();
                        }
                    });
                }
            });

            if (data.complete) {
                t.find('.infolist').append(`<li>${data.rotorCount}x${data.turntableCount} Images</li>`);
                t.find('.infolist').append(`<li>${humanReadableFilesize(data.zipSize)}</li>`);
                t.find('.infolist').append(`<li>${data.range}</li>`);
            } else {
                t.find('.infolist').append('<li>Aborted</li>');
            }


            t.find('.t-cloud-up').click(() => {
                Scann3r.sio.emit('proxy', data.id, (err, r) => {
                    if (err) {

                        alert(err);
                    }
                });
            });


            t.find('.thumbnail-image').attr('src', data.thumb);
            t.find('.thumbnail-text').text('#' + data.id);
            t.find('.t-download').attr('href', '/' + data.id + '/images-' + data.id + '.zip');


            if (typeof data.resultZip != 'undefined') {
                t.find('.t-cloud-down').attr('href', '/' + data.id + '/' + data.resultZip);
            } else {
                t.find('.t-cloud-down').hide();
            }
            return t;
        },
        append:
            (thumb) => {
                $('#thumbs').append(thumb);
            },
        prepend:
            (thumb) => {
                $('#thumbs').prepend(thumb);
            }
    }


}

$(() => {
    Scann3r.start();
});