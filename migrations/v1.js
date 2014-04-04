
module.exports = function upgrade(v0) {

    var v1 = {
        version: '1',
        layers: [],
        constants: v0.constants,
        styles: {},
        sprite: v0.sprite
    };


    // parse buckets

    var bucketStyles = {};

    var bucketIndex = {
        background: ['background']
    };

    function jsonValue(value) {
        return typeof value === 'string' ? '\'' + value + '\'' : value;
    }

    function getValueFilter(value) {
        return v0bucket.field + ' == ' + jsonValue(value);
    }

    function pointValue(p) {
        return [p.x, p.y];
    }

    for (var id in v0.buckets) {
        var v0bucket = v0.buckets[id];
        var bucket = {id: id};

        // parse filters

        var filters = [];

        if (v0bucket.source) {
            filters.push('source == ' + jsonValue(v0bucket.source));
        }
        if (v0bucket.layer) {
            filters.push('layer == ' + jsonValue(v0bucket.layer));
        }
        if (v0bucket.value) {
            var valueFilters = (Array.isArray(v0bucket.value) ? v0bucket.value : [v0bucket.value]).map(getValueFilter);
            if (valueFilters.length > 1) {
                filters.push('(' + valueFilters.join(' || ') + ')');
            } else {
                filters.push(valueFilters.join(' || '));
            }
        }
        if (v0bucket.feature_type) {
            filters.push('feature_type == ' + jsonValue(v0bucket.feature_type));
        }
        if (filters.length) {
            bucket.filter = filters.join(' && ');
        }

        // parse styles

        var styles = {};

        if (v0bucket.enabled) styles['min-zoom'] = v0bucket.enabled;

        // line styles
        if (v0bucket.cap)        styles['line-cap'] = v0bucket.cap;
        if (v0bucket.join)       styles['line-join'] = v0bucket.join;
        if (v0bucket.roundLimit) styles['line-round-limit'] = v0bucket.roundLimit;

        // point styles
        if (v0bucket.spacing)    styles['point-spacing'] = v0bucket.spacing;
        if (v0bucket.size)       styles['point-size'] = pointValue(v0bucket.size);

        // text styles
        if (v0bucket.text_field) styles['text-field'] = v0bucket.text_field;
        if (v0bucket.font)       styles['text-font'] = v0bucket.font;
        if (v0bucket.fontSize)   styles['text-size'] = v0bucket.fontSize;
        if (v0bucket.path)       styles['text-path'] = v0bucket.path;
        if (v0bucket.padding)    styles['text-padding'] = v0bucket.padding;

        if (v0bucket.textMinDistance) styles['text-min-dist'] = v0bucket.textMinDistance;
        if (v0bucket.maxAngleDelta)   styles['text-max-angle'] = v0bucket.maxAngleDelta;
        if (v0bucket.alwaysVisible)   styles['text-always-visible'] = v0bucket.alwaysVisible;

        if (Object.keys(styles).length) {
            bucketStyles[id] = styles;
        }

        bucketIndex[id] = bucket;
    }


    // parse structure

    var layerIndex = {};

    function parseStructure(structure) {
        var buckets = [];

        for (var i = 0; i < structure.length; i++) {

            var layerId = structure[i].name,
                bucketId = structure[i].bucket,
                bucket = {id: layerId};

            if (structure[i].layers) {
                bucket.layers = parseStructure(structure[i].layers);
            } else {
                layerIndex[layerId] = bucketId;
                bucket.filter = bucketIndex[bucketId].filter;
            }

            buckets.push(bucket);
        }

        return buckets;
    }

    v1.layers = parseStructure(v0.structure);


    // parse styles

    var typedRules = {
        color: 'color',
        width: 'width',
        opacity: 'opacity',
        image: 'image',
        translate: 'translate',
        dasharray: 'dasharray',
        antialias: 'antialias',
        alignment: 'alignment',
        radius: 'radius',
        blur: 'blur'
    };

    var otherRules = {
        stroke: 'line-color',
        strokeWidth: 'line-width',
        enabled: 'min-zoom'
    };

    function convertValue(v0value, v0rule) {
        if (Array.isArray(v0value)) {
            if (v0value[0] === 'linear' || v0value[0] === 'exponential') {
                var value = {
                    fn: v0value[0],
                    z: v0value[1],
                    val: v0value[2],
                    slope: v0value[3],
                    min: v0value[4]
                };
                if (v0value[5]) {
                    value.max = v0value[5];
                }
                return value;
            }
            if (v0value[0] === 'stops') {
                return {
                    fn: 'stops',
                    stops: v0value.slice(1).map(function (v) {
                        return [v.z, v.val];
                    }, {})
                };
            }
            if (v0value[0] === 'min') {
                if (v0rule === 'enabled') return v0value[1];
                return {
                    fn: 'min',
                    val: v0value[1]
                }
            }
        }

        return v0value;
    }

    function convertRule(layerId, style, v0rule, v0value) {
        var transition = v0rule.indexOf('transition-') === 0;

        v0rule = v0rule.replace('transition-', '');

        var typed = typedRules[v0rule],
            v0bucket = v0.buckets[layerIndex[layerId]];

        var rule =
            typed && v0bucket && v0bucket.type ? v0bucket.type + '-' + typed :
            typed && layerIndex[layerId] === 'background' ? 'fill-' + typed :
            otherRules[v0rule] || v0rule;

        if (v0bucket && v0bucket.type === 'text') {
            if (v0rule === 'strokeWidth') rule = 'text-halo-width';
            if (v0rule === 'stroke') rule = 'text-halo-color';
        }

        style[transition ? 'transition-' + rule : rule] = convertValue(v0value, v0rule);
    }

    for (var i = 0; i < v0.classes.length; i++) {
        var klass = v1.styles[v0.classes[i].name] = {};

        for (var layerId in v0.classes[i].layers) {
            var v0rules = v0.classes[i].layers[layerId];
            var style = klass[layerId] = {};

            for (var rule in v0rules) {
                convertRule(layerId, style, rule, v0rules[rule]);
            }

            if (bucketStyles[layerIndex[layerId]]) {
                var bucketStyle = bucketStyles[layerIndex[layerId]];
                for (rule in bucketStyle) {
                    style[rule] = bucketStyle[rule];
                }
            }
        }
    }

    return v1;
};