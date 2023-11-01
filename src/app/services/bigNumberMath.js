
import {BigNumber} from 'bignumber.js';

export default {
	BN: BigNumber,
	equal: function(a,b){
		var A = new BigNumber(String(a));
		var B = new BigNumber(String(b));
		return A == B;
	},
	add: function(a,b){
		console.log(a,b);
		var A = new BigNumber(String(a));
		var B = new BigNumber(String(b));
		return A.plus(B)
	},
	subtract: function(a,b){
		var A = new BigNumber(String(a));
		var B = new BigNumber(String(b));
		return A.minus(B)
	},
	divideBy: function(a,b){
		var A = new BigNumber(String(a));
		var B = new BigNumber(String(b));
		return A.dividedBy(B)
	},
	multiplyBy: function(a,b){
		var A = new BigNumber(String(a));
		var B = new BigNumber(String(b));
		return A.multipliedBy(B)
	}
}