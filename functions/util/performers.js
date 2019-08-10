const isEmpty = require('validator/lib/isEmpty');
exports.reduceUserDetails = (receivedData) => {
    let details = {};
    if(!isEmpty(receivedData.bio.trim())){
        details.bio = receivedData.bio;
    }

    if(receivedData.website){
        if(receivedData.website.substring(0,4) !== 'http'){
            details.website = `http://${receivedData.website.trim()}`;
        }
        else{
            details.website = receivedData.website;
        }
    }
    return details;
}