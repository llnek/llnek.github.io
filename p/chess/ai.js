/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright © 2025, Kenneth Leung. All rights reserved. */

;(function(window,UNDEF){

  "use strict";

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  window["io/czlab/chess/AI"]=function(Mojo){

    const Mini= window["io/czlab/mcfud/algo/minimax"]();
    const {Game:_G,
           ute:_,is}=Mojo;

    //https://www.chessprogramming.org/Simplified_Evaluation_Function
    // pawn
    const PAWN=[[0,  0,  0,  0,  0,  0,  0,  0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5,  5, 10, 25, 25, 10,  5,  5],
                [0,  0,  0, 20, 20,  0,  0,  0],
                [5, -5,-10,  0,  0,-10, -5,  5],
                [5, 10, 10,-20,-20, 10, 10,  5],
                [0,  0,  0,  0,  0,  0,  0,  0]];
    // knight
    const KNIGHT=[[-50,-40,-30,-30,-30,-30,-40,-50],
                  [-40,-20,  0,  0,  0,  0,-20,-40],
                  [-30,  0, 10, 15, 15, 10,  0,-30],
                  [-30,  5, 15, 20, 20, 15,  5,-30],
                  [-30,  0, 15, 20, 20, 15,  0,-30],
                  [-30,  5, 10, 15, 15, 10,  5,-30],
                  [-40,-20,  0,  5,  5,  0,-20,-40],
                  [-50,-40,-30,-30,-30,-30,-40,-50]];
    // bishop
    const BISHOP=[[-20,-10,-10,-10,-10,-10,-10,-20],
                  [-10,  0,  0,  0,  0,  0,  0,-10],
                  [-10,  0,  5, 10, 10,  5,  0,-10],
                  [-10,  5,  5, 10, 10,  5,  5,-10],
                  [-10,  0, 10, 10, 10, 10,  0,-10],
                  [-10, 10, 10, 10, 10, 10, 10,-10],
                  [-10,  5,  0,  0,  0,  0,  5,-10],
                  [-20,-10,-10,-10,-10,-10,-10,-20]];
    //rook
    const ROOK=[[0,  0,  0,  0,  0,  0,  0,  0],
                [5, 10, 10, 10, 10, 10, 10,  5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [0,  0,  0,  5,  5,  0,  0,  0]];
    //queen
    const QUEEN=[[-20,-10,-10, -5, -5,-10,-10,-20],
                 [-10,  0,  0,  0,  0,  0,  0,-10],
                 [-10,  0,  5,  5,  5,  5,  0,-10],
                 [-5,  0,  5,  5,  5,  5,  0, -5],
                 [0,  0,  5,  5,  5,  5,  0, -5],
                 [-10,  5,  5,  5,  5,  5,  0,-10],
                 [-10,  0,  5,  0,  0,  0,  0,-10],
                 [-20,-10,-10, -5, -5,-10,-10,-20]];
    //king middle game
    const KING=[[-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-20,-30,-30,-40,-40,-30,-30,-20],
                [-10,-20,-20,-20,-20,-20,-20,-10],
                [20, 20,  0,  0,  0,  0, 20, 20],
                [20, 30, 10,  0,  0, 10, 30, 20]];
    // king end game
    const END=[[-50,-40,-30,-20,-20,-30,-40,-50],
               [-30,-20,-10,  0,  0,-10,-20,-30],
               [-30,-10, 20, 30, 30, 20,-10,-30],
               [-30,-10, 30, 40, 40, 30,-10,-30],
               [-30,-10, 30, 40, 40, 30,-10,-30],
               [-30,-10, 20, 30, 30, 20,-10,-30],
               [-30,-30,  0,  0,  0,  0,-30,-30],
               [-50,-30,-30,-30,-30,-30,-30,-50]];

    const VALUES={
      p:100,//P:100,
      n:320,//N:320,
      b:330,//B:330,
      r:500,//R:500,
      q:900,//Q:900,
      k:20000//,K:20000
    };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function mirror(src){
      return src.reduce((acc,r)=>{
        acc.unshift(r.slice());
        return acc;
      },[])
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const TABLES={
      w:{
        p:PAWN,
        n:KNIGHT,
        b:BISHOP,
        r:ROOK,
        q:QUEEN,
        k:KING
      },
      b:{
        p:mirror(PAWN),
        n:mirror(KNIGHT),
        b:mirror(BISHOP),
        r:mirror(ROOK),
        q:mirror(QUEEN),
        k:mirror(KING)
      }
    };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /** @class */
    class CZ extends Mini.GameBoard{
      constructor(p1v,p2v){
        super();
        this.actors= [0, p1v, p2v];
        this.grid=null;
        this.depth=4;
      }
      syncState(seed, actor){
        this.actors[0] = actor;
        this.grid= seed;
      }
      getNextMoves(snap){
        let moves= snap.state.moves({verbose:true});
        //console.log("ai-moves ====== ");
        //console.log( JSON.stringify(moves));
        return moves;
      }
      undoMove(snap,move){
        snap.state.undo();
      }
      doMove(snap, move){
        let r= snap.state.move(move);
        //console.log(snap.state.ascii());
        return r;
      }
      takeGFrame(){
        let ff = new Mini.GFrame();
        ff.state=this.grid;
        ff.other= this.getOtherPlayer(this.actors[0]);
        ff.cur= this.actors[0];
        ff.lastBestMove=null;
        return ff;
      }
      isStalemate(snap){
      }
      isOver(snap,move){
      }
      evalScore(snap,move){
        let me= this.actors[2];//the maxer
        let m= snap.state.board();
        let v,w=0,b=0;
        m.forEach((r,y)=> r.forEach((c,x)=>{
          if(c){
            v= VALUES[c.type]+TABLES[c.color][c.type][y][x];
            if(c.color=="w") w+=v;
            else b +=v;
          }
        }));
        //always return from maxer's pov
        return me.uuid()=="w"?w-b:b-w;
      }
    }

    _G.AI=function(p1,p2){ return new CZ(p1,p2) };

  }

})(this);


