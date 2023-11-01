 import loader from './loaders';


 var Modal = {
     element: document.getElementById('pinModal'),
     show: function(attrs) {
         Modal.element.classList.add("open")
         Modal.element.classList.add("slideInDown")
         Modal.element.classList.remove("fadeOut");

     },
     hide: function() {
         Modal.element.classList.add("fadeOut");
         Modal.element.classList.remove("slideInDown");
         setTimeout(function() {Modal.element.classList.remove("open"); }, 500);
     },
     launch: function(component, attrs) {
         m.render(Modal.element, m('.modal-body', m(component, attrs)));
         //add background     
         return Modal.show(attrs);
     },
     loader: function(message, options) {
         options = options || {};
         Modal.launch({
             view: function(vnode) {
                 return m('div.modal-loader', [m('h6', message, m('.blue-stroke', m(loader(options.loader_type || "rings"))))])
             }
         })
     }
 }

 export default Modal;