export default function(message) {
    return {
        view: function() {
            return [
                m('.loader-full', [
                    m('.loader-full-container', message || 'Loading...')
                ])
            ]
        }
    };
}