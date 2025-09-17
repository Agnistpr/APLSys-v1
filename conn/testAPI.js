import axios from "axios";

axios.post('http://localhost:8000/classify', { text: 'John Doe graduated from MIT.' })
  .then(res => console.log(res.data))
  .catch(err => console.error(err));
